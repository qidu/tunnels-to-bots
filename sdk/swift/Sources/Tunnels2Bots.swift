/**
 * Tunnels2Bots iOS/macOS SDK
 * Swift client for connecting to tunnels-to-bots server
 *
 * Usage:
 * <pre>
 * let client = Client(serverURL: "wss://your-server.com/ws", apiKey: "your-key")
 * 
 * client.onMessage = { message in
 *     print("Received: \\(message.text)")
 * }
 * 
 * client.connect()
 * client.sendMessage(to: "bot_id", text: "Hello!")
 * </pre>
 */

import Foundation

/// Main client class for iOS/macOS
public class Client {
    private let serverURL: URL
    private let apiKey: String
    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    private var reconnecting = false
    
    // Event handlers
    public var onConnect: ((Bool) -> Void)?
    public var onDisconnect: ((Int, String) -> Void)?
    public var onMessage: ((Message) -> Void)?
    public var onError: ((Error) -> Void)?
    public var onAuthError: ((String) -> Void)?
    
    private let jsonEncoder = JSONEncoder()
    private let jsonDecoder = JSONDecoder()
    
    public init(serverURL: URL, apiKey: String) {
        self.serverURL = URL(string: serverURL.absoluteString + "?token=\(apiKey)")!
        self.apiKey = apiKey
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
    }
    
    /// Connect to the server
    public func connect() {
        let request = URLRequest(url: serverURL)
        webSocket = session.webSocketTask(with: request)
        webSocket?.resume()
        receiveMessage()
    }
    
    /// Disconnect from the server
    public func disconnect() {
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
    }
    
    /// Send a text message
    @discardableResult
    public func sendMessage(to: String, text: String, replyTo: String? = nil) -> String {
        var data: [String: Any] = [
            "to": to,
            "text": text
        ]
        if let replyTo = replyTo {
            data["replyTo"] = replyTo
        }
        return sendFrame(type: "message", data: data)
    }
    
    /// Create a task for a bot
    @discardableResult
    public func createTask(
        botId: String,
        title: String,
        description: String,
        priority: Priority = .medium,
        dueDate: String? = nil
    ) -> String {
        var data: [String: Any] = [
            "botId": botId,
            "title": title,
            "description": description,
            "priority": priority.rawValue
        ]
        if let dueDate = dueDate {
            data["dueDate"] = dueDate
        }
        return sendFrame(type: "task", data: data)
    }
    
    /// Subscribe to bot updates
    public func subscribeToBot(_ botId: String) {
        sendFrame(type: "subscribe", data: ["botId": botId])
    }
    
    /// Unsubscribe from bot updates
    public func unsubscribeFromBot(_ botId: String) {
        sendFrame(type: "unsubscribe", data: ["botId": botId])
    }
    
    /// Request server status
    public func requestStatus(_ request: StatusRequest = .full) {
        sendFrame(type: "status", data: ["request": request.rawValue])
    }
    
    // MARK: - Private Methods
    
    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                self.handleMessage(message)
                self.receiveMessage()
                
            case .failure(let error):
                self.handleError(error)
                if !(error is URLError && error.code == .cancelledByPeer) {
                    self.scheduleReconnect()
                }
            }
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            parseMessage(text)
        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                parseMessage(text)
            }
        @unknown default:
            break
        }
    }
    
    private func parseMessage(_ json: String) {
        guard let data = json.data(using: .utf8),
              let frame = try? jsonDecoder.decode(Frame.self, from: data) else {
            return
        }
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            switch frame.type {
            case "message":
                if let messageData = frame.data {
                    let message = Message(
                        id: frame.id ?? UUID().uuidString,
                        from: messageData["from"] as? String ?? "",
                        to: messageData["to"] as? String ?? "",
                        text: messageData["text"] as? String ?? "",
                        timestamp: messageData["timestamp"] as? String ?? ""
                    )
                    self.onMessage?(message)
                }
                
            case "status":
                // Handle status updates
                break
                
            case "auth_ok":
                self.reconnectAttempts = 0
                self.reconnecting = false
                self.onConnect?(true)
                
            case "auth_error":
                self.onAuthError?(frame.data?["message"] as? String ?? "Unknown error")
                
            case "error":
                print("Server error: \(frame.data?["message"] ?? "Unknown")")
                
            default:
                break
            }
        }
    }
    
    @discardableResult
    private func sendFrame(type: String, data: [String: Any]) -> String {
        guard let ws = webSocket else { return "" }
        
        let id = UUID().uuidString
        let frame: [String: Any] = [
            "type": type,
            "data": data,
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "id": id
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: frame),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            ws.send(.string(jsonString))
        }
        
        return id
    }
    
    private func scheduleReconnect() {
        guard reconnectAttempts < maxReconnectAttempts, !reconnecting else { return }
        
        reconnecting = true
        reconnectAttempts += 1
        
        let delay = 5000 * pow(1.5, Double(reconnectAttempts - 1))
        
        DispatchQueue.main.asyncAfter(deadline: .now() + delay / 1000) { [weak self] in
            self?.connect()
        }
    }
    
    private func handleError(_ error: Error) {
        DispatchQueue.main.async { [weak self] in
            self?.onError?(error)
        }
    }
    
    public var isConnected: Bool {
        webSocket != nil
    }
}

// MARK: - Supporting Types

public struct Message {
    public let id: String
    public let from: String
    public let to: String
    public let text: String
    public let timestamp: String
    
    public init(id: String, from: String, to: String, text: String, timestamp: String) {
        self.id = id
        self.from = from
        self.to = to
        self.text = text
        self.timestamp = timestamp
    }
}

public enum Priority: String {
    case low, medium, high, urgent
}

public enum StatusRequest: String {
    case full, connections, bots
}

private struct Frame: Codable {
    let type: String
    let data: [String: Any]?
    let id: String?
    let timestamp: Int?
    
    enum CodingKeys: String, CodingKey {
        case type, data, id, timestamp
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        timestamp = try container.decodeIfPresent(Int.self, forKey: .timestamp)
        
        // Decode data as untyped dictionary
        if container.contains(.data) {
            let dataValue = try container.decode(AnyCodable.self, forKey: .data)
            data = dataValue.value as? [String: Any]
        } else {
            data = nil
        }
    }
}

private struct AnyCodable: Codable {
    let value: Any
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if let intValue = try? container.decode(Int.self) {
            value = intValue
        } else if let doubleValue = try? container.decode(Double.self) {
            value = doubleValue
        } else if let stringValue = try? container.decode(String.self) {
            value = stringValue
        } else if let boolValue = try? container.decode(Bool.self) {
            value = boolValue
        } else if let arrayValue = try? container.decode([AnyCodable].self) {
            value = arrayValue.map { $0.value }
        } else if let dictValue = try? container.decode([String: AnyCodable].self) {
            value = dictValue.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case let intValue as Int:
            try container.encode(intValue)
        case let doubleValue as Double:
            try container.encode(doubleValue)
        case let stringValue as String:
            try container.encode(stringValue)
        case let boolValue as Bool:
            try container.encode(boolValue)
        case let arrayValue as [Any]:
            try container.encode(arrayValue.map { AnyCodable(value: $0) })
        case let dictValue as [String: Any]:
            try container.encode(dictValue.mapValues { AnyCodable(value: $0) })
        default:
            try container.encodeNil()
        }
    }
    
    init(value: Any) {
        self.value = value
    }
}

// MARK: - Bot Extension

extension Client {
    /// Get list of user's bots
    public func getBots(completion: @escaping ([Bot]) -> Void) {
        requestStatus(.bots)
        // In a full implementation, this would capture the response
    }
    
    /// Create a new bot
    public func createBot(name: String, type: BotType, completion: @escaping (Bot) -> Void) {
        // In a full implementation, this would call the REST API
    }
}

public struct Bot {
    public let id: String
    public let name: String
    public let type: BotType
    public var status: String
    
    public init(id: String, name: String, type: BotType) {
        self.id = id
        self.name = name
        self.type = type
        self.status = "offline"
    }
}

public enum BotType: String, Codable {
    case openclaw = "openclaw"
    case custom = "custom"
    case webhook = "webhook"
    case llm = "llm"
}