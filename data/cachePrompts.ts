export type CacheType = 'prompt' | 'semantic' | 'prefix' | 'kv';

export type CachePrompt = {
    number: number;
    executionType: string;
    prompt: string;
    validation: string;
};

const promptValidation = 'Exact same prompt; expect cache reuse after first request';
const semanticValidation = 'Different wording, same/similar meaning; expect semantic reuse if threshold matches';
const prefixValidation = 'Keep prefix exactly identical; change only final instruction; expect cached prefix tokens';
const kvValidation = 'Run as one continuous conversation/session; monitor KV reuse and TTFT';

export const cachePrompts: Record<CacheType, CachePrompt[]> = {
    prompt: Array.from({ length: 10 }, (_, index) => ({
        number: index + 1,
        executionType: 'Standalone request',
        prompt: 'Explain artificial intelligence in simple terms with 3 real-world examples.',
        validation: promptValidation
    })),
    semantic: [
        'What is the capital of India?',
        'Which city is the capital of India?',
        "Tell me the name of India's capital city.",
        'Which city serves as the capital of India?',
        "In which city is India's central government based?",
        'What city is officially the capital of India?',
        "Can you tell me India's capital?",
        'Name the capital city of India.',
        "Which Indian city is the country's capital?",
        "India's capital is located in which city?"
    ].map((prompt, index) => ({ number: index + 1, executionType: 'Standalone request', prompt, validation: semanticValidation })),
    prefix: [
        'Explain what regression testing is.',
        'Explain what smoke testing is.',
        'Explain what API testing is.',
        'Explain what load testing is.',
        'Explain what stress testing is.',
        'Explain what Playwright is.',
        'Explain what end-to-end testing is.',
        'Explain what performance testing is.',
        'Explain what test automation is.',
        'Explain what AI model testing is.'
    ].map((question, index) => ({
        number: index + 1,
        executionType: 'Standalone request',
        prompt: `You are a senior software testing expert. Provide accurate, practical and easy-to-understand answers. Use structured explanations with headings and bullet points. Give real-world examples. Focus on software testing, automation testing, API testing, performance testing and AI testing.\n\n${question}`,
        validation: prefixValidation
    })),
    kv: [
        'My name is Rahul. I am a software test engineer.',
        'I primarily use Playwright with TypeScript for automation testing.',
        'I also perform API testing and performance testing.',
        'Recently, I started testing AI inference platforms and text-generation models.',
        'The platform supports multiple language models and provides an API for inference.',
        'I want to validate the platform for functional testing, performance testing and caching behavior.',
        'Based on everything I have told you, summarize my testing requirements.',
        'Now create 5 functional test scenarios based on those requirements.',
        'Now create 5 performance test scenarios based on the same requirements.',
        'Finally, create a complete testing strategy covering functional testing, performance testing and caching validation.'
    ].map((prompt, index) => ({ number: index + 1, executionType: `Conversation Turn ${index + 1}`, prompt, validation: kvValidation }))
};
