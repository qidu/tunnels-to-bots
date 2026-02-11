package com.tunnels2bots.demo

import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.tunnels2bots.demo.databinding.ActivityMainBinding

/**
 * Tunnels2Bots Android Demo
 * Simple chat interface demonstrating the SDK
 */
class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private val client = Tunnels2BotsClient.getInstance()
    private val gson = Gson()
    private val messages = mutableListOf<Message>()
    private lateinit var adapter: MessageAdapter
    private var selectedBot: Bot? = null
    
    data class Message(val text: String, val isSent: Boolean, val isSystem: Boolean = false)
    data class Bot(val id: String, val name: String, val status: String)
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupUI()
        setupClient()
    }
    
    private fun setupUI() {
        adapter = MessageAdapter(messages)
        binding.messagesRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.messagesRecyclerView.adapter = adapter
        
        binding.connectButton.setOnClickListener {
            if (client.isConnected()) {
                client.disconnect()
            } else {
                connect()
            }
        }
        
        binding.sendButton.setOnClickListener { sendMessage() }
        binding.quickHi.setOnClickListener { quickSend("Hello!") }
        binding.quickHelp.setOnClickListener { quickSend("Help me") }
        binding.quickJoke.setOnClickListener { quickSend("Tell me a joke") }
        binding.createTaskButton.setOnClickListener { createTask() }
    }
    
    private fun setupClient() {
        client.on("connect") { _ ->
            runOnUiThread {
                updateConnectionStatus(true)
                addMessage("Connected!", false, true)
                client.requestStatus()
            }
        }
        
        client.on("disconnect") { _ ->
            runOnUiThread {
                updateConnectionStatus(false)
                addMessage("Disconnected", false, true)
            }
        }
        
        client.on("auth_ok") { data ->
            runOnUiThread {
                data?.let {
                    val userId = it.get("userId")?.asString ?: "unknown"
                    addMessage("Authenticated as $userId", false, true)
                }
            }
        }
        
        client.on("status") { data ->
            runOnUiThread {
                data?.let { d ->
                    if (d.has("bots")) {
                        val bots = mutableListOf<Bot>()
                        d.getAsJsonArray("bots").forEach { bot ->
                            bot.asJsonObject.let { obj ->
                                bots.add(Bot(
                                    obj.get("id")?.asString ?: "",
                                    obj.get("name")?.asString ?: "Bot",
                                    obj.get("status")?.asString ?: "offline"
                                ))
                            }
                        }
                        showBots(bots)
                    }
                }
            }
        }
        
        client.on("message") { data ->
            runOnUiThread {
                data?.let {
                    val text = it.get("text")?.asString ?: ""
                    if (text.isNotEmpty()) {
                        addMessage(text, false)
                    }
                }
            }
        }
        
        client.on("task_status") { _ ->
            runOnUiThread {
                addMessage("Task created!", false, true)
            }
        }
        
        client.on("error") { data ->
            runOnUiThread {
                data?.let {
                    addMessage("Error: ${it.get("message")?.asString}", false, true)
                }
            }
        }
    }
    
    private fun connect() {
        val serverUrl = binding.serverUrlInput.text.toString().ifEmpty { "ws://10.0.2.2:3000/ws" }
        val apiKey = binding.apiKeyInput.text.toString().ifEmpty { "t2b_demo" }
        
        updateConnectionStatus(null)
        addMessage("Connecting...", false, true)
        
        try {
            client.connect(serverUrl, apiKey)
        } catch (e: Exception) {
            addMessage("Connection failed: ${e.message}", false, true)
        }
    }
    
    private fun sendMessage() {
        val text = binding.messageInput.text.toString().trim()
        if (text.isEmpty() || selectedBot == null) {
            Toast.makeText(this, "Select a bot and enter message", Toast.LENGTH_SHORT).show()
            return
        }
        
        client.sendMessage(selectedBot!!.id, text)
        addMessage(text, true)
        binding.messageInput.text?.clear()
    }
    
    private fun quickSend(text: String) {
        if (selectedBot == null) {
            Toast.makeText(this, "Select a bot first", Toast.LENGTH_SHORT).show()
            return
        }
        client.sendMessage(selectedBot!!.id, text)
        addMessage(text, true)
    }
    
    private fun createTask() {
        val title = binding.taskTitleInput.text.toString().trim()
        val desc = binding.taskDescInput.text.toString().trim()
        val priorityPos = binding.taskPrioritySpinner.selectedItemPosition
        val priority = when (priorityPos) {
            0 -> "low"
            1 -> "medium"
            2 -> "high"
            3 -> "urgent"
            else -> "medium"
        }
        
        if (title.isEmpty() || selectedBot == null) {
            Toast.makeText(this, "Enter task title and select a bot", Toast.LENGTH_SHORT).show()
            return
        }
        
        client.createTask(selectedBot!!.id, title, desc, priority)
        binding.taskTitleInput.text?.clear()
        binding.taskDescInput.text?.clear()
        addMessage("Task: $title", false, true)
    }
    
    private fun showBots(bots: List<Bot>) {
        val names = bots.map { "${it.name} (${it.status})" }
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, names)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.botSpinner.adapter = adapter
        
        binding.botSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p0: android.widget.AdapterView<*>?, p1: View?, position: Int, id: Long) {
                selectedBot = bots[position]
                client.subscribeToBot(bots[position].id)
                addMessage("Selected ${bots[position].name}", false, true)
            }
            override fun onNothingSelected(p0: android.widget.AdapterView<*>?) {}
        }
    }
    
    private fun updateConnectionStatus(connected: Boolean?) {
        runOnUiThread {
            when (connected) {
                true -> {
                    binding.connectionStatus.text = "Connected"
                    binding.connectionStatus.setTextColor(android.graphics.Color.parseColor("#00ff88"))
                    binding.connectButton.text = "Disconnect"
                }
                false -> {
                    binding.connectionStatus.text = "Disconnected"
                    binding.connectionStatus.setTextColor(android.graphics.Color.parseColor("#ff4444"))
                    binding.connectButton.text = "Connect"
                }
                null -> {
                    binding.connectionStatus.text = "Connecting..."
                    binding.connectionStatus.setTextColor(android.graphics.Color.parseColor("#ffaa00"))
                }
            }
        }
    }
    
    private fun addMessage(text: String, isSent: Boolean, isSystem: Boolean = false) {
        messages.add(Message(text, isSent, isSystem))
        adapter.notifyItemInserted(messages.size - 1)
        binding.messagesRecyclerView.scrollToPosition(messages.size - 1)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        client.disconnect()
    }
}
