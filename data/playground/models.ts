export type PlaygroundCapability = 'text-generation' | 'text-to-speech';

export interface PlaygroundModel {
    id: string;
    displayName: string;
    capability: PlaygroundCapability;
}

export const textGenerationModels: PlaygroundModel[] = [
    { id: 'Llama3-1-8B', displayName: 'Llama 3.1 8B', capability: 'text-generation' },
    { id: 'GPT-OSS-20B', displayName: 'GPT-OSS 20B', capability: 'text-generation' },
    { id: 'DeepSeek-R1-Distill-Llama-70B', displayName: 'DeepSeek R1 70B', capability: 'text-generation' },
    { id: 'Sarvam-m', displayName: 'Sarvam-M', capability: 'text-generation' },
    { id: 'Qwen2.5-VL-72B-Instruct', displayName: 'Qwen2.5-VL-72B', capability: 'text-generation' },
    { id: 'GPT-OSS-120B', displayName: 'GPT-OSS 120B', capability: 'text-generation' },
    { id: 'Qwen3-14B', displayName: 'Qwen3-14B', capability: 'text-generation' },
    { id: 'Moonlight-16B-A3B-Instruct', displayName: 'Moonlight-16B', capability: 'text-generation' },
    { id: 'Mistral-Nemo-Inferor-12B', displayName: 'Mistral Nemo Inferor 12B', capability: 'text-generation' },
    { id: 'Qwen3.5-27B', displayName: 'Qwen3.5-27B', capability: 'text-generation' },
    { id: 'Gemma4-31b-it', displayName: 'Gemma4-31b-it', capability: 'text-generation' },
    { id: 'QwQ-32B', displayName: 'QwQ-32B', capability: 'text-generation' },
    { id: 'Qwen3.5-35B-A3B', displayName: 'Qwen3.5-35B-A3B', capability: 'text-generation' },
    { id: 'Mixtral-8x7B-Instruct-v0.1', displayName: 'Mixtral-8x7B-Instruct-v0.1', capability: 'text-generation' },
    { id: 'Llama-3.1-70B-Instruct', displayName: 'Llama-3.1-70B-Instruct', capability: 'text-generation' },
    { id: 'Llama-4-Scout-17B-16E-Instruct', displayName: 'Llama-4-Scout-17B-16E-Instruct', capability: 'text-generation' }
];

/** A canary model keeps smoke runs fast; the full suite always covers all models. */
export const textGenerationModelsForRun = process.env.PLAYWRIGHT_SMOKE === 'true'
    ? [textGenerationModels[0]]
    : textGenerationModels;

export const kokoroTextToSpeechModel: PlaygroundModel = {
    id: 'hexgrad/Kokoro-82M',
    displayName: 'Kokoro 82M',
    capability: 'text-to-speech'
};
