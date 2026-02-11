package com.tunnels2bots.demo

import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.net.URI
import com.google.gson.Gson
import com.google.gson.JsonObject

/**
 * Tunnels2Bots Android SDK
 * Simple WebSocket client for connecting to tunnels-to-bots server
 */
class Tunnels2BotsClient private constructor() {
    private var ws: WebSocketClient? = null
    private val gson = Gson()
    private val handlers = mutableMapOf<String, MutableList<(JsonObject) -> Unit>>()
    
    companion object {
        @Volatile private var instance: Tunnels2BotsClient? = null
        
        fun getInstance(): Tunnels2BotsClient {
            return instance ?: synchronized(this) {
                instance ?: Tunnels2BotsClient().also { instance = it }
            }
        }
    }
    
    /**
     * Connect to server
     */
    fun connect(serverUrl: String, apiKey: String) {
        if (ws?.isOpen == true) {
            ws?.close()
        }
        
        val uri = URI("$serverUrl?token=$apiKey")
        ws = object : WebSocketClient(uri) {
            override fun onOpen(handshakedata: ServerHandshake?) {
                notifyHandlers("connect", gson.toJsonTree(mapOf("connected" to true)))
            }
            
            override fun onMessage(message: String?) {
                try {
                    val frame = gson.fromJson(message, JsonObject::class.java)
                    val type = frame.get("type")?.asString ?: return
                    val data = frame.get("data")?.asJsonObject ?: JsonObject()
                    notifyHandlers(type, data)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            
            override fun onClose(code: Int, reason: String?, remote: Boolean) {
                notifyHandlers("disconnect", gson.toJsonTree(mapOf("code" to code, "reason" to reason)))
            }
            
            override fun onError(ex: Exception?) {
                notifyHandlers("error", gson.toJsonTree(mapOf("message" to (ex?.message ?: "Unknown error"))))
            }
        }
        ws?.connect()
    }
    
    /**
     * Disconnect from server
     */
    fun disconnect() {
        ws?.close()
        ws = null
    }
    
    /**
     * Send a message
     */
    fun sendMessage(to: String, text: String) {
        sendFrame("message", mapOf("to" to to, "text" to text))
    }
    
    /**
     * Create a task for a bot
     */
    fun createTask(botId: String, title: String, description: String, priority: String) {
        sendFrame("task", mapOf(
            "botId" to botId,
            "title" to title,
            "description" to description,
            "priority" to priority
        ))
    }
    
    /**
     * Subscribe to bot updates
     */
    fun subscribeToBot(botId: String) {
        sendFrame("subscribe", mapOf("botId" to botId))
    }
    
    /**
     * Request status
     */
    fun requestStatus() {
        sendFrame("status", mapOf("request" to "full"))
    }
    
    /**
     * Register event handler
     */
    fun on(event: String, handler: (JsonObject) -> Unit) {
        if (!handlers.containsKey(event)) {
            handlers[event] = mutableListOf()
        }
        handlers[event]?.add(handler)
    }
    
    /**
     * Check if connected
     */
    fun isConnected(): Boolean = ws?.isOpen == true
    
    private fun sendFrame(type: String, data: Map<String, Any>) {
        val frame = JsonObject().apply {
            addProperty("type", type)
            add("data", gson.toJsonTree(data))
            addProperty("timestamp", System.currentTimeMillis())
            addProperty("id", "${System.currentTimeMillis()}-${(1000..9999).random()}")
        }
        ws?.send(gson.toJson(frame))
    }
    
    private fun notifyHandlers(type: String, data: JsonObject) {
        handlers[type]?.forEach { it(data) }
        handlers["*"]?.forEach { it(gson.toJsonTree(mapOf("type" to type, "data" to data)) }
    }
}
