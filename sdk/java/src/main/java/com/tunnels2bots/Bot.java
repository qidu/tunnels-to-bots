package com.tunnels2bots;

import java.util.*;

/**
 * Bot management class
 * 
 * Usage:
 * <pre>
 * Bot bot = client.createBot("My Assistant", "openclaw");
 * client.assignTask(bot.getId(), "Help me with coding");
 * </pre>
 */
public class Bot {
    private final String id;
    private final String name;
    private final String type;
    private String status = "offline";
    private final Map<String, Object> config = new HashMap<>();
    
    public Bot(String id, String name, String type) {
        this.id = id;
        this.name = name;
        this.type = type;
    }
    
    public String getId() { return id; }
    public String getName() { return name; }
    public String getType() { return type; }
    public String getStatus() { return status; }
    
    public void setStatus(String status) { this.status = status; }
    public void setConfig(String key, Object value) { config.put(key, value); }
    public Object getConfig(String key) { return config.get(key); }
    
    /**
     * Create a task for this bot
     */
    public Task createTask(Client client, String title, String description, Client.Priority priority) {
        String taskId = client.createTask(id, title, description, priority);
        return new Task(taskId, title, description, priority.name());
    }
    
    /**
     * Task class
     */
    public static class Task {
        private final String id;
        private final String title;
        private final String description;
        private final String priority;
        private String status = "pending";
        
        public Task(String id, String title, String description, String priority) {
            this.id = id;
            this.title = title;
            this.description = description;
            this.priority = priority;
        }
        
        public String getId() { return id; }
        public String getTitle() { return title; }
        public String getDescription() { return description; }
        public String getPriority() { return priority; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }
}