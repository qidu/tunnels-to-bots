package com.tunnels2bots.demo

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class MessageAdapter(
    private val messages: List<MainActivity.Message>
) : RecyclerView.Adapter<MessageAdapter.MessageViewHolder>() {
    
    class MessageViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val textView: TextView = view.findViewById(android.R.id.text1)
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(android.R.layout.simple_list_item_1, parent, false)
        return MessageViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: MessageViewHolder, position: Int) {
        val msg = messages[position]
        holder.textView.text = msg.text
        holder.itemView.setBackgroundColor(
            when {
                msg.isSystem -> android.graphics.Color.parseColor("#3d3d00")
                msg.isSent -> android.graphics.Color.parseColor("#4a148c")
                else -> android.graphics.Color.parseColor("#2d2d2d")
            }
        )
        holder.textView.setTextColor(
            when {
                msg.isSystem -> android.graphics.Color.parseColor("#ffc107")
                else -> android.graphics.Color.WHITE
            }
        )
    }
    
    override fun getItemCount() = messages.size
}
