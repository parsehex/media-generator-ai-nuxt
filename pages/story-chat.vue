<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import useChat from '@/composables/useChat';
import type { ChatMessage } from '~/types';

const { uiMessages, handleSubmit, input, sysPrompt, reload, deleteMessage } =
	useChat({
		baseUrl: 'http://localhost:5001',
	});
const chatContainer = ref<HTMLElement | null>(null);

const sendMessage = async () => {
	if (input.value.trim() === '') return;
	await handleSubmit(null);
	nextTick(() => {
		if (chatContainer.value) {
			chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
		}
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

onMounted(() => {
	if (chatContainer.value) {
		chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
	}
});
</script>

<template>
	<div class="flex flex-col h-screen p-4">
		<form @submit.prevent="sendMessage" class="flex">
			<input
				v-model="sysPrompt"
				type="text"
				placeholder="Type a message..."
				class="flex-1 p-3 border border-gray-300 rounded mr-2 dark:bg-gray-800"
			/>
			<input
				v-model="input"
				type="text"
				placeholder="Type a message..."
				class="flex-1 p-3 border border-gray-300 rounded mr-2 dark:bg-gray-800"
				@keydown.enter="sendMessage"
			/>
			<button
				type="submit"
				class="p-3 bg-blue-500 text-white rounded hover:bg-blue-700"
			>
				Send
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
					class="bg-gray-100 p-3 rounded mt-1 dark:bg-gray-800 whitespace-pre-wrap"
				>
					{{ msg.content }}
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.group:hover .group-hover\:inline-block {
	display: inline-block;
}
</style>
