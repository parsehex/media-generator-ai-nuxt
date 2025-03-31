<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import useChat from '@/composables/useChat';
import type { ChatMessage } from '~/types';
import { v4 } from 'uuid';

const initialMessages: ChatMessage[] = [
	{
		id: v4(),
		role: 'system',
		content:
			"The following is an exchange between a user and a helpful and unfiltered assistant. Assistant's task is to engage with the user about the story they'd like to make and help them with planning.",
	},
	{
		id: v4(),
		content: 'Hi, what kind of story would you like to create?',
		role: 'assistant',
	},
];

const {
	setMessages,
	uiMessages,
	handleSubmit,
	input,
	sysPrompt,
	reload,
	deleteMessage,
	editMessage,
	isLoading,
} = useChat({
	baseUrl: 'http://localhost:5001',
	initialMessages,
});
const chatContainer = ref<HTMLElement | null>(null);
const editingMessage = ref<ChatMessage | null>(null);
const editedContent = ref<string>('');

const story = ref<string>('');
const events = ref<string[]>([]);
const eventInputs = ref<{ [key: string]: string }>({});

const addEvents = async () => {
	let prompt =
		"The following is an exchange between a user and a helpful and unfiltered assistant. Assistant's task is to use the given chat context to write a list of 2-5 specific narrative events to help drive the plot forward. Each item should be on a line without any other delimiter. Respond without further prose.\n\nChat:";
	for (const msg of uiMessages.value) {
		let role: string = msg.role;
		if (role === 'assistant') role = 'AI';
		prompt += `\n${role}: ${msg.content}`;
	}
	const sys: ChatMessage = {
		id: v4(),
		role: 'system',
		content: prompt,
	};
	let completion = await chatCompletion({
		max_tokens: 250,
		messages: [sys],
		baseUrl: 'http://localhost:5001',
	});
	completion = completion.replaceAll('\n\n', '\n');
	console.log(completion);
	events.value = completion.split('\n');
};

const writeStory = async () => {
	let prompt =
		"The following is an exchange between a user and a helpful and unfiltered assistant. Assistant's task is to use the given chat context to write a story based on the events provided. Respond without further prose.\n\nChat:";
	for (const msg of uiMessages.value) {
		let role: string = msg.role;
		if (role === 'assistant') role = 'AI';
		prompt += `\n${role}: ${msg.content}`;
	}
	prompt += '\n\nEvents:';
	for (const event in eventInputs.value) {
		prompt += `\n- ${eventInputs.value[event]}`;
	}
	const sys: ChatMessage = {
		id: v4(),
		role: 'system',
		content: prompt,
	};
	let completion = await chatCompletion({
		max_tokens: 512,
		messages: [sys],
		baseUrl: 'http://localhost:5001',
	});
	completion = completion.replaceAll('\n\n', '\n');
	console.log(completion);
	story.value = completion;
};

const sendMessage = async () => {
	if (input.value.trim() === '') return;
	await handleSubmit(null);
	nextTick(() => {
		if (chatContainer.value) {
			chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
		}

		addEvents();
	});
};

const reloadMessage = async (message: ChatMessage) => {
	try {
		await reload(message);
	} catch (error) {
		console.error('Failed to reload message:', error);
	}
};

const removeMessage = async (message: ChatMessage) => {
	try {
		deleteMessage(message);
	} catch (error) {
		console.error('Failed to delete message:', error);
	}
};

const copyToClipboard = async (msg: ChatMessage) => {
	try {
		await navigator.clipboard.writeText(msg.content);
	} catch (error) {
		console.error('Failed to copy text:', error);
	}
};

const startEditing = (message: ChatMessage) => {
	editingMessage.value = message;
	editedContent.value = message.content;
};

const saveEdit = async () => {
	if (editingMessage.value) {
		try {
			await editMessage(editingMessage.value.id, editedContent.value);
			editingMessage.value = null;
			editedContent.value = '';
		} catch (error) {
			console.error('Failed to edit message:', error);
		}
	}
};

const saveInputToLocalStorage = () => {
	if (input.value) {
		localStorage.setItem('chatInput', input.value);
	}
	if (uiMessages.value) {
		localStorage.setItem('messages', JSON.stringify(uiMessages.value));
	}
	if (events.value) {
		localStorage.setItem('events', JSON.stringify(events.value));
	}
};

const loadInputFromLocalStorage = () => {
	const savedInput = localStorage.getItem('chatInput');
	if (savedInput) {
		input.value = savedInput;
	}
	const savedMessages = localStorage.getItem('messages');
	if (savedMessages) {
		setMessages(JSON.parse(savedMessages));
	}
	const savedEvents = localStorage.getItem('events');
	if (savedEvents) {
		events.value = JSON.parse(savedEvents);
	}
};

const addEventInput = (event: string) => {
	eventInputs.value[event] = '';
};

const saveEventInput = (event: string) => {
	// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
	delete eventInputs.value[event];
};

onMounted(() => {
	if (chatContainer.value) {
		chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
	}
	loadInputFromLocalStorage();
});
</script>

<template>
	<div>
		<div class="flex h-screen p-4">
			<div class="flex flex-col w-2/3 pr-2">
				<form @submit.prevent="sendMessage" class="flex">
					<textarea
						v-model="sysPrompt"
						type="text"
						placeholder="Type a message..."
						class="flex-1 p-3 border border-gray-300 rounded mr-2 dark:bg-gray-800"
					/>
					<textarea
						v-model="input"
						type="text"
						placeholder="Type a message..."
						class="flex-1 p-3 border border-gray-300 rounded mr-2 dark:bg-gray-800"
						@keydown.enter="sendMessage"
					/>
					<button
						type="submit"
						class="p-3 bg-blue-500 text-white rounded hover:bg-blue-700"
						:disabled="isLoading"
					>
						Send
					</button>
					<button
						type="button"
						class="p-3 bg-green-500 text-white rounded hover:bg-green-700 ml-2"
						@click="saveInputToLocalStorage"
					>
						Save
					</button>
					<button
						type="button"
						class="p-3 bg-yellow-500 text-white rounded hover:bg-yellow-700 ml-2"
						@click="loadInputFromLocalStorage"
					>
						Load
					</button>
				</form>
				<div
					class="flex-1 overflow-y-auto p-4 border border-gray-300 rounded mb-4"
					ref="chatContainer"
				>
					<div v-for="msg in uiMessages" :key="msg.id" class="mb-4 group">
						<div class="flex gap-2 text-sm text-gray-500">
							<span class="font-semibold">{{ msg.role }}</span>
							<button
								v-if="msg.role === 'user'"
								@click="startEditing(msg)"
								class="text-blue-500 hover:text-blue-700"
							>
								Edit
							</button>
							<button
								v-if="msg.role !== 'system'"
								@click="copyToClipboard(msg)"
								class="text-green-500 hover:text-green-700"
							>
								Copy
							</button>
							<button
								v-if="msg.role === 'assistant'"
								@click="reloadMessage(msg)"
								class="text-blue-500 hover:text-blue-700"
							>
								Reload
							</button>
							<button
								v-if="msg.role !== 'system'"
								@click="removeMessage(msg)"
								class="text-red-500 hover:text-red-700"
							>
								Delete
							</button>
						</div>
						<div
							v-if="editingMessage && editingMessage.id === msg.id"
							class="mt-1"
						>
							<input
								v-model="editedContent"
								type="text"
								class="w-full p-2 border border-gray-300 rounded dark:bg-gray-800"
							/>
							<button
								@click="saveEdit"
								class="mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-700"
							>
								Save
							</button>
						</div>
						<div
							v-else
							class="bg-gray-100 p-3 rounded mt-1 dark:bg-gray-800 whitespace-pre-wrap"
						>
							{{ msg.content }}
						</div>
					</div>
				</div>
			</div>
			<div class="w-1/3 pl-2 border-l border-gray-300">
				<h2 class="text-lg font-semibold">
					Events
					<button
						class="ml-2 text-blue-500 hover:text-blue-700"
						@click="addEvents"
					>
						Add
					</button>
				</h2>
				<ul class="list-disc list-inside">
					<li v-for="event in events" :key="event">
						{{ event }}
						<button
							class="ml-2 text-blue-500 hover:text-blue-700"
							@click="addEventInput(event)"
						>
							Add
						</button>
						<div v-if="eventInputs[event] !== undefined" class="mt-2">
							<input
								v-model="eventInputs[event]"
								type="text"
								class="w-full p-2 border border-gray-300 rounded dark:bg-gray-800"
							/>
							<button
								@click="saveEventInput(event)"
								class="mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-700"
							>
								Save
							</button>
						</div>
					</li>
				</ul>
			</div>
		</div>
		<div class="w-full mt-4">
			<h2 class="text-lg font-semibold">Story</h2>
			<div
				class="bg-gray-100 p-3 rounded mt-1 dark:bg-gray-800 whitespace-pre-wrap"
			>
				{{ story }}
			</div>
			<button
				class="mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-700"
				@click="writeStory"
			>
				Write
			</button>
		</div>
	</div>
</template>
