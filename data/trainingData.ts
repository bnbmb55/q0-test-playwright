export interface ModelConfig {
    model: string;
    category: string;
    task: string;
    provider: 'GCP' | 'Azure';
    region: string;
    sftPath: string;
    rlhfPath: string;
    supportsRLHF: boolean;
    preferredQuantization: 'AWQ' | 'F16';
    sftLabel: string;
    rlhfLabel: string;
}

export const trainingModels: ModelConfig[] = [
    {
        model: 'Llama3-1-8B',
        category: 'Large Language Model',
        task: 'Text Generation',
        provider: 'GCP',
        region: 'asia-south1',
        sftPath: 'gs://inference-training-data/llama3-8b/dataset.json',
        rlhfPath: 'gs://inference-training-data/llama3-8b/rlhfllama.zip',
        supportsRLHF: true,
        preferredQuantization: 'AWQ',
        sftLabel: 'SFT (Supervised Fine-Tuning)',
        rlhfLabel: 'RLHF (Reinforcement Learning from Human Feedback)'
    },
    {
        model: 'Stable-diffusion-3.5',
        category: 'Diffusion Model',
        task: 'Text-to-Image',
        provider: 'GCP',
        region: 'asia-south1',
        sftPath: 'gs://inference-training-data/SD35/cc_data.zip',
        rlhfPath: 'gs://inference-training-data/SD35/rlhf.zip',
        supportsRLHF: true,
        preferredQuantization: 'F16',
        sftLabel: 'SFT (Supervised Fine-Tuning)',
        rlhfLabel: 'RLHF (Reinforcement Learning from Human Feedback)'
    },
    {
        model: 'PaddleOCR-VL',
        category: 'Vision-Language Model',
        task: 'Image-to-Text',
        provider: 'GCP',
        region: 'asia-south1',
        sftPath: 'gs://inference-training-data/Paddle_OCR/paddle_ocr_dataset.zip',
        rlhfPath: 'gs://inference-training-data/Paddle_OCR/paddle_rlhf_dataset.zip',
        supportsRLHF: true,
        preferredQuantization: 'F16',
        sftLabel: 'SFT (Supervised Fine-Tuning)',
        rlhfLabel: 'Direct Preference Optimization(DPO)'
    },
    {
        model: 'Whisper-Large-V3',
        category: 'Automatic Speech Recognition',
        task: 'audio-to-text',
        provider: 'GCP',
        region: 'asia-south1',
        sftPath: 'gs://inference-training-data/Whisper-Finetuning/dataset.zip',
        rlhfPath: '',
        supportsRLHF: false,
        preferredQuantization: 'F16',
        sftLabel: 'Single GPU',
        rlhfLabel: ''
    }
];
