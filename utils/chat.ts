import axios from 'axios';

interface GenerateCompletionOptions {
	messages: ChatMessage[];
	max_tokens?: number;
	temperature?: number;
	body?: Record<string, unknown>;
	baseUrl?: string;
}

export async function chatCompletion(
	options: GenerateCompletionOptions
): Promise<string> {
	let baseUrl = (options.baseUrl = options.baseUrl + '/v1/chat/completions');
	if (!baseUrl) baseUrl = 'http://localhost:8080/v1/chat/completions';

	if (!options.temperature) options.temperature = 0.35;

	try {
		const response = await axios.post(
			baseUrl,
			{
				...options.body,
				messages: options.messages,
				max_tokens: options.max_tokens,
				temperature: options.temperature,
			},
			{
				headers: {
					'Content-Type': 'application/json',
				},
			}
		);

		const assistantMessage = response.data.choices[0].message;
		return assistantMessage.content.trim();
	} catch (error) {
		console.error('Error generating completion:', error);
		throw error;
	}
}
