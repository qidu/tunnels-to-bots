package com.tunnels2bots;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.*;

/**
 * Main client class for Android SDK
 * 
 * Usage:
 * <pre>
 * Client client = new Client("wss://your-server.com/ws", "your-api-key");
 * client.connect();
 * 
 * client.onMessage(msg -> {
 *     System.out.println("Received: " + msg.getText());
 * });
 * 
 * client.sendMessage("bot_id", "Hello Bot!");
 * </pre>
 */
public class Client {
    private final String serverUrl;
    private final String apiKey;
    private WebSocketClient wsClient;
    private final Gson gson = new Gson();
    private final Map<String, MessageHandler> handlers = new ConcurrentHashMap<>();
    private volatile boolean connected = false;
    private volatile boolean reconnecting = false;
    private int reconnectAttempts = 0;
    private ScheduledExecutorService scheduler;
    
    // Event listeners
    private final List<Consumer<Boolean>> connectListeners = new CopyOnWriteArrayList<>();
    private final List<Consumer<Message>> messageListeners = new CopyOnWriteArrayList<>();
    private final List<Consumer<Exception>> errorListeners = new CopyOnWriteArrayList<>();
    
    public Client(String serverUrl, String apiKey) {
        this.serverUrl = serverUrl;
        this.apiKey = apiKey;
        this.scheduler = Executors.newSingleThreadScheduledExecutor();
    }
    
    /**
     * Connect to the server
     */
    public void connect() {
        if (connected) return;
        
        try {
            String authUrl = serverUrl + (serverUrl.contains("?") ? "&" : "?") + "token=" + apiKey;
            
            wsClient = new WebSocketClient(new URI(authUrl)) {
                @Override
                public void onOpen(ServerHandshake handshakedata) {
                    connected = true;
                    reconnectAttempts = 0;
                    reconnecting = false;
                    notifyConnect(true);
                }
                
                @Override
                public void onMessage(String message) {
                    handleMessage(message);
                }
                
                @Override
                public void onClose(int code, String reason, boolean remote) {
                    connected = false;
                    notifyConnect(false);
                    
                    if (!remote && !reconnecting) {
                        scheduleReconnect();
                    }
                }
                
                @Override
                public void onError(Exception ex) {
                    notifyError(ex);
                }
            };
            
            wsClient.connect();
            
        } catch (Exception e) {
            notifyError(e);
        }
    }
    
    /**
     * Disconnect from the server
     */
    public void disconnect() {
        if (wsClient != null) {
            wsClient.close();
            wsClient = null;
        }
        connected = false;
        scheduler.shutdown();
    }
    
    /**
     * Send a text message
     */
    public String sendMessage(String to, String text) {
        return sendFrame("message", new MessageData(to, text));
    }
    
    /**
     * Create a task for a bot
     */
    public String createTask(String botId, String title, String description, Priority priority) {
        JsonObject data = new JsonObject();
        data.addProperty("botId", botId);
        data.addProperty("title", title);
        data.addProperty("description", description);
        data.addProperty("priority", priority.name().toLowerCase());
        return sendFrame("task", data);
    }
    
    /**
     * Subscribe to bot updates
     */
    public void subscribeToBot(String botId) {
        JsonObject data = new JsonObject();
        data.addProperty("botId", botId);
        sendFrame("subscribe", data);
    }
    
    /**
     * Request server status
     */
    public void requestStatus(String request) {
        JsonObject data = new JsonObject();
        data.addProperty("request", request);
        sendFrame("status", data);
    }
    
    /**
     * Register message handler
     */
    public void onMessage(MessageHandler handler) {
        messageListeners.add(handler);
    }
    
    /**
     * Register connect listener
     */
    public void onConnect(Consumer<Boolean> listener) {
        connectListeners.add(listener);
    }
    
    /**
     * Register error listener
     */
    public void onError(Consumer<Exception> listener) {
        errorListeners.add(listener);
    }
    
    // Private methods
    
    private String sendFrame(String type, Object data) {
        if (wsClient == null || !wsClient.isOpen()) {
            throw new IllegalStateException("Not connected");
        }
        
        JsonObject frame = new JsonObject();
        frame.addProperty("type", type);
        frame.add("data", gson.toJsonTree(data));
        frame.addProperty("timestamp", System.currentTimeMillis());
        frame.addProperty("id", UUID.randomUUID().toString());
        
        String json = gson.toJson(frame);
        wsClient.send(json);
        
        return frame.get("id").getAsString();
    }
    
    private void handleMessage(String json) {
        try {
            JsonObject frame = gson.fromJson(json, JsonObject.class);
            String type = frame.get("type").getAsString();
            JsonObject data = frame.getAsJsonObject("data");
            
            switch (type) {
                case "message":
                    Message msg = parseMessage(data);
                    messageListeners.forEach(l -> l.onMessage(msg));
                    break;
                case "status":
                    handleStatus(data);
                    break;
                case "auth_ok":
                    // Handle auth success
                    break;
                case "auth_error":
                    notifyError(new RuntimeException(data.get("message").getAsString()));
                    break;
                case "error":
                    notifyError(new RuntimeException(data.get("message").getAsString()));
                    break;
            }
            
        } catch (Exception e) {
            notifyError(e);
        }
    }
    
    private Message parseMessage(JsonObject data) {
        String type = data.get("type").getAsString();
        
        switch (type) {
            case "text":
                return new TextMessage(
                    data.get("id").getAsString(),
                    data.get("from").getAsString(),
                    data.get("to").getAsString(),
                    data.get("text").getAsString(),
                    data.get("timestamp").getAsString()
                );
            case "media":
                return new MediaMessage(
                    data.get("id").getAsString(),
                    data.get("from").getAsString(),
                    data.get("to").getAsString(),
                    data.get("url").getAsString(),
                    data.get("mediaType").getAsString(),
                    data.get("mimeType").getAsString()
                );
            default:
                return new Message(
                    data.get("id").getAsString(),
                    data.get("from").getAsString(),
                    data.get("to").getAsString(),
                    type,
                    data.get("timestamp").getAsString()
                );
        }
    }
    
    private void handleStatus(JsonObject data) {
        String statusType = data.get("type").getAsString();
        // Handle different status types
    }
    
    private void scheduleReconnect() {
        if (reconnectAttempts >= 10) {
            reconnecting = false;
            return;
        }
        
        reconnecting = true;
        reconnectAttempts++;
        
        long delay = 5000 * (long) Math.pow(1.5, reconnectAttempts - 1);
        
        scheduler.schedule(() -> {
            if (!connected) {
                connect();
            }
        }, delay, TimeUnit.MILLISECONDS);
    }
    
    private void notifyConnect(boolean connected) {
        connectListeners.forEach(l -> l.accept(connected));
    }
    
    private void notifyError(Exception e) {
        errorListeners.forEach(l -> l.accept(e));
    }
    
    /**
     * Check if connected
     */
    public boolean isConnected() {
        return connected;
    }
    
    /**
     * Priority levels for tasks
     */
    public enum Priority {
        LOW, MEDIUM, HIGH, URGENT
    }
    
    /**
     * Message interface
     */
    public interface Message {
        String getId();
        String getFrom();
        String getTo();
        String getType();
        String getTimestamp();
    }
    
    /**
     * Message handler
     */
    public interface MessageHandler {
        void onMessage(Message message);
    }
    
    // Message classes
    
    public static class Message implements Client.Message {
        private final String id, from, to, type, timestamp;
        
        public Message(String id, String from, String to, String type, String timestamp) {
            this.id = id;
            this.from = from;
            this.to = to;
            this.type = type;
            this.timestamp = timestamp;
        }
        
        public String getId() { return id; }
        public String getFrom() { return from; }
        public String getTo() { return to; }
        public String getType() { return type; }
        public String getTimestamp() { return timestamp; }
    }
    
    public static class TextMessage extends Message {
        private final String text;
        
        public TextMessage(String id, String from, String to, String text, String timestamp) {
            super(id, from, to, "text", timestamp);
            this.text = text;
        }
        
        public String getText() { return text; }
    }
    
    public static class MediaMessage extends Message {
        private final String url, mediaType, mimeType;
        
        public MediaMessage(String id, String from, String to, String url, String mediaType, String mimeType) {
            super(id, from, to, "media", "");
            this.url = url;
            this.mediaType = mediaType;
            this.mimeType = mimeType;
        }
        
        public String getUrl() { return url; }
        public String getMediaType() { return mediaType; }
        public String getMimeType() { return mimeType; }
    }
    
    private static class MessageData {
        String to;
        String text;
        
        MessageData(String to, String text) {
            this.to = to;
            this.text = text;
        }
    }
}