export interface AwsDatasetCatalogEntry {
    model: string;
    s3Uri: string;
    format: 'json' | 'jsonl' | 'zip';
}

export interface AwsTrainingScenario extends AwsDatasetCatalogEntry {
    category: string;
    task: string;
    trainingTypeLabel: string;
    preferredQuantization: 'AWQ' | 'F16';
}

/**
 * Inventory of supplied AWS SFT datasets. Entries are deliberately separate
 * from executable scenarios: a model is enabled only after its exact UI task
 * and compatible training configuration have been verified.
 */
export const awsDatasetCatalog: AwsDatasetCatalogEntry[] = [
    { model: 'Kimi-VL-A3', s3Uri: 's3://q0-testing/Kimi_VL_A3/kimi-dataset.zip', format: 'zip' },
    { model: 'Moonlight-16B-A3B-Instruct', s3Uri: 's3://q0-testing/Moonlight/normal_moonlight_dataset.json', format: 'json' },
    { model: 'Kimi-Audio', s3Uri: 's3://q0-testing/Kimi-audio/Kimi_Audio_Normal.zip', format: 'zip' },
    { model: 'Chandra-OCR', s3Uri: 's3://q0-testing/Chandra-OCR/Chandra_normal_training.zip', format: 'zip' },
    { model: 'Surya-OCR', s3Uri: 's3://q0-testing/Surya_OCR/surya_OCR_Dataset.zip', format: 'zip' },
    { model: 'PaddleOCR-VL', s3Uri: 's3://q0-testing/Paddle_OCR/paddle_ocr_dataset.zip', format: 'zip' },
    { model: 'Qwen3-14B', s3Uri: 's3://q0-testing/qwen3-14b/train_data.zip', format: 'zip' },
    { model: 'GPT-OSS-120B', s3Uri: 's3://q0-testing/GPT-OSS-120B/gpt-120B-normal.zip', format: 'zip' },
    { model: 'Qwen2.5-VL-72B-Instruct', s3Uri: 's3://q0-testing/Qwen-VLM-72B/Qwen_72B.zip', format: 'zip' },
    { model: 'Sarvam-M', s3Uri: 's3://q0-testing/Sarvam-M/sarvam_normal.zip', format: 'zip' },
    { model: 'DeepSeek-R1-Distill-Llama-70B', s3Uri: 's3://q0-testing/deepseek/DeepSeek-R1-Distill-Llama-70B.zip', format: 'zip' },
    { model: 'Stable-diffusion-3.5', s3Uri: 's3://q0-testing/SD35/cc_data.zip', format: 'zip' },
    { model: 'GPT-OSS-20B', s3Uri: 's3://q0-testing/GPT-OSS-20b/medical_harmony.jsonl', format: 'jsonl' },
    { model: 'Whisper-Large-V3', s3Uri: 's3://q0-testing/Whisper-Finetuning/dataset.zip', format: 'zip' },
    { model: 'Llama3-1-8B', s3Uri: 's3://q0-testing/llama3-8b/dataset.json', format: 'json' },
    { model: 'Gemma3-Vision', s3Uri: 's3://q0-testing/Gemma3_vision/amazon_vlm_dataset.zip', format: 'zip' }
];

/**
 * Executable AWS SFT coverage. These use model/task labels already exercised
 * by the current UI suite. Add catalog entries here only after validating the
 * model's displayed category, task, and supported training type.
 */
export const awsTrainingScenarios: AwsTrainingScenario[] = [
    {
        model: 'Llama3-1-8B',
        category: 'Large Language Model',
        task: 'Text Generation',
        s3Uri: 's3://q0-testing/llama3-8b/dataset.json',
        format: 'json',
        trainingTypeLabel: 'SFT (Supervised Fine-Tuning)',
        preferredQuantization: 'AWQ'
    },
    {
        model: 'Stable-diffusion-3.5',
        category: 'Diffusion Model',
        task: 'Text-to-Image',
        s3Uri: 's3://q0-testing/SD35/cc_data.zip',
        format: 'zip',
        trainingTypeLabel: 'SFT (Supervised Fine-Tuning)',
        preferredQuantization: 'F16'
    },
    {
        model: 'PaddleOCR-VL',
        category: 'Vision-Language Model',
        task: 'Image-to-Text',
        s3Uri: 's3://q0-testing/Paddle_OCR/paddle_ocr_dataset.zip',
        format: 'zip',
        trainingTypeLabel: 'SFT (Supervised Fine-Tuning)',
        preferredQuantization: 'F16'
    },
    {
        model: 'Whisper-Large-V3',
        category: 'Automatic Speech Recognition',
        task: 'audio-to-text',
        s3Uri: 's3://q0-testing/Whisper-Finetuning/dataset.zip',
        format: 'zip',
        trainingTypeLabel: 'Single GPU',
        preferredQuantization: 'F16'
    }
];
