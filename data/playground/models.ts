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
    { id: 'Moonlight-16B-A3B-Instruct', displayName: 'Moonlight-16B', capability: 'text-generation' }
];

export const kokoroTextToSpeechModel: PlaygroundModel = {
    id: 'hexgrad/Kokoro-82M',
    displayName: 'Kokoro 82M',
    capability: 'text-to-speech'
};
