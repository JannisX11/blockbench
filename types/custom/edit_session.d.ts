/// <reference types="./blockbench"/>

/**
 * An edit session instance. Edit sessions can be attached to a project to collaborate on it with multiple users via P2P connections.
 */
declare class EditSession {
	constructor()

	active: boolean
	hosting: boolean
	clients: {}
	client_count: number
	data_queue: []
	chat_history: []
	Project: ModelProject | null

	updateClientCound(): void
	start(username?: string): void
	join(username: string, token: string): void
	quit(): void
	setState(active: boolean): void
	copyToken(): void
	initNewModel(force?: boolean): void
	initConnection(conn: any): void
	sendAll(type: string, data: any): void
	sendEdit(entry: UndoEntry): void
	receiveData(tag: any): void
	processData(tag: any): void
	catchUp(): void
	/**
	 * Send a chat message
	 * @param text Text to send. If omitted, the current text in the chat panel input is sent
	 */
	sendChat(text?: string): void
	addChatMessage(message: any): any
	processChatMessage(data: any): void
}
