import { ref, computed } from 'vue';
import axios from 'axios';
import { v4 } from 'uuid';

interface UseChatOptions {
	initialMessages?: ChatMessage[];
	body?: Record<string, unknown>;
	onFinish?: (messages: ChatMessage[]) => void;
	onError?: (error: Error) => void;
	baseUrl?: string;
}

const BASE_URL = 'http://localhost:8080';

export default function useChat(options?: UseChatOptions) {
	const BaseUrl = ref('');

	const messages = ref([] as ChatMessage[]);
	const uiMessages = computed(() =>
		messages.value.filter((msg) => msg.role !== 'system')
	);

	const input = ref('');
	const isLoading = ref(false);

	const controller = new AbortController();

	const sysPrompt = computed({
		get: () => messages.value[0]?.content,
		set: (value: string) => {
			messages.value[0].content = value;
		},
	});

	async function handleSubmit(e: Event | null, skipUserMsg = false) {
		if (!skipUserMsg) {
			const userMsg = {
				id: v4(),
				role: 'user',
				content: input.value,
			};
			messages.value.push(userMsg as ChatMessage);
		}

		// clear input
		input.value = '';
		e?.preventDefault();

		isLoading.value = true;
		// send new messages to server, create assistant message
		const msg = ref({
			created: Date.now(),
			updated: null,
			id: v4(),
			role: 'assistant',
			content: '',
			image: null,
			tts: null,
			thread_id: '',
			thread_index: 0,
		} as ChatMessage);
		messages.value.push(msg.value);
		await axios({
			url: BaseUrl.value,
			method: 'post',
			headers: {
				'Content-Type': 'application/json',
			},
			signal: controller.signal,
			data: { ...options?.body, messages: messages.value, stream: true },
			onDownloadProgress: (progressEvent) => {
				const xhr = progressEvent.event.target;
				const { responseText } = xhr;
				// responseText contains all chunks so far
				const chunks = responseText.split('data:').map((c: string) => c.trim());
				let content = '';
				let isLast = false;
				for (const chunkStr of chunks) {
					if (!chunkStr) continue;
					if (chunkStr.trim() === '[DONE]') {
						isLast = true;
						break;
					}

					const chunk = JSON.parse(chunkStr);
					content += chunk.choices[0].delta.content || '';

					// does chunk have `usage` object?
					if (chunk.usage) {
						isLast = true;
					}
				}
				msg.value.content = content.trim();

				if (isLast) {
					isLoading.value = false;
					// TODO detect and fix cut off messages

					if (options?.onFinish) {
						options.onFinish(messages.value);
					}
				}
			},
		});
	}

	function setMessages(newMessages: ChatMessage[]) {
		messages.value = newMessages;
	}

	async function reload(messageToReload: ChatMessage) {
		if (messageToReload.role !== 'assistant') {
			throw new Error('Can only reload assistant messages');
		}

		const index = messages.value.findIndex(
			(msg) => msg.id === messageToReload.id
		);
		if (index === -1) {
			throw new Error('Message not found');
		}

		const newMessages = messages.value.slice(0, index);
		const otherMessages = messages.value.slice(index + 1);

		messages.value = newMessages;

		await handleSubmit(new Event('reload'), true);

		messages.value.push(...otherMessages);
	}

	function stop() {
		// TODO need to test this
		controller.abort();
	}

	function append(message: ChatMessage) {
		messages.value.push(message);
		handleSubmit(new Event('append'), true);
	}

	function deleteMessage(messageToDelete: ChatMessage) {
		const index = messages.value.findIndex(
			(msg) => msg.id === messageToDelete.id
		);
		if (index === -1) {
			throw new Error('Message not found');
		}

		const role = messageToDelete.role;
		if (role === 'system') {
			throw new Error('Cannot delete system message');
		}

		messages.value.splice(index, 1);

		const nextMsg = messages.value[index];
		const prevMsg = messages.value[index - 1];

		if (messageToDelete.role === 'user' && nextMsg?.role === 'assistant') {
			messages.value.splice(index, 1);
		}

		if (messageToDelete.role === 'assistant' && prevMsg?.role === 'user') {
			messages.value.splice(index - 1, 1);
		}
	}

	function editMessage(messageId: string, newContent: string) {
		const index = messages.value.findIndex((msg) => msg.id === messageId);
		if (index === -1) {
			throw new Error('Message not found');
		}

		const role = messages.value[index].role;
		if (role === 'system') {
			throw new Error('Cannot edit system message');
		}

		messages.value[index].content = newContent;
	}

	// useChat init
	if (options?.initialMessages) {
		setMessages(options.initialMessages);
	}
	(async () => {
		if (options?.baseUrl) {
			BaseUrl.value = options.baseUrl + '/v1/chat/completions';
			return;
		}
		BaseUrl.value = BASE_URL + '/v1/chat/completions';
	})();

	return {
		messages: computed(() => messages.value),
		uiMessages,
		sysPrompt,
		input,
		handleSubmit,
		setMessages,
		reload,
		isLoading,
		stop,
		append,
		deleteMessage,
		editMessage,
	};
}
