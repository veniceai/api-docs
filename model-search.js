// Venice AI Model Browser & Pricing Tables - Fetches from API
(function() {

  // ========== FEATURE FLAGS ==========
  const ENABLE_VIDEO = true;  // Video models on /models pages
  // ===================================

  // Configuration
  const API_BASE = 'https://api.venice.ai/api/v1/models';
  const MODEL_TYPES = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'music', ...(ENABLE_VIDEO ? ['video'] : [])];
  const CACHE_KEY = 'venice-models-cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Static fallback data for instant pricing page load (updated 2026-03-18)
  const STATIC_MODELS = [{"id":"flux-2-max-edit","type":"inpaint","model_spec":{"privacy":"anonymized","pricing":{"inpaint":{"usd":0.09,"diem":0.09}},"traits":[],"name":"Flux 2 Max"},"created":1767571200},{"id":"gpt-image-1-5-edit","type":"inpaint","model_spec":{"privacy":"anonymized","pricing":{"inpaint":{"usd":0.36,"diem":0.36}},"traits":[],"name":"GPT Image 1.5"},"created":1767555000},{"id":"grok-imagine-edit","type":"inpaint","model_spec":{"privacy":"anonymized","pricing":{"inpaint":{"usd":0.04,"diem":0.04}},"traits":[],"name":"Grok Imagine"},"created":1769644800},{"id":"nano-banana-2-edit","type":"inpaint","model_spec":{"privacy":"anonymized","pricing":{"inpaint":{"usd":0.1,"diem":0.1}},"traits":[],"name":"Nano Banana 2"},"created":1772064000},{"id":"nano-banana-pro-edit","type":"inpaint","model_spec":{"privacy":"anonymized","pricing":{"inpaint":{"usd":0.18,"diem":0.18}},"traits":[],"name":"Nano Banana Pro"},"created":1765584000},{"id":"qwen-edit","type":"inpaint","model_spec":{"privacy":"private","pricing":{"inpaint":{"usd":0.04,"diem":0.04}},"traits":[],"name":"Qwen Edit 2511"},"created":1756157864},{"id":"qwen-image-2-edit","type":"inpaint","model_spec":{"privacy":"anonymized","pricing":{"inpaint":{"usd":0.05,"diem":0.05}},"traits":[],"name":"Qwen Image 2"},"created":1772582400},{"id":"qwen-image-2-pro-edit","type":"inpaint","model_spec":{"privacy":"anonymized","pricing":{"inpaint":{"usd":0.1,"diem":0.1}},"traits":[],"name":"Qwen Image 2 Pro"},"created":1772582400},{"id":"seedream-v4-edit","type":"inpaint","model_spec":{"privacy":"anonymized","pricing":{"inpaint":{"usd":0.05,"diem":0.05}},"traits":[],"name":"SeedreamV4.5"},"created":1767484800},{"id":"seedream-v5-lite-edit","type":"inpaint","model_spec":{"privacy":"anonymized","pricing":{"inpaint":{"usd":0.05,"diem":0.05}},"traits":[],"name":"SeedreamV5 Lite"},"created":1771804800},{"id":"tts-kokoro","type":"tts","model_spec":{"privacy":"private","pricing":{"input":{"usd":3.5,"diem":3.5}},"traits":[],"name":"Kokoro Text to Speech","voices":["af_alloy","af_aoede","af_bella","af_heart","af_jadzia","af_jessica","af_kore","af_nicole","af_nova","af_river","af_sarah","af_sky","am_adam","am_echo","am_eric","am_fenrir","am_liam","am_michael","am_onyx","am_puck","am_santa","bf_alice","bf_emma","bf_lily","bm_daniel","bm_fable","bm_george","bm_lewis","ef_dora","em_alex","em_santa","ff_siwis","hf_alpha","hf_beta","hm_omega","hm_psi","if_sara","im_nicola","jf_alpha","jf_gongitsune","jf_nezumi","jf_tebukuro","jm_kumo","pf_dora","pm_alex","pm_santa","zf_xiaobei","zf_xiaoni","zf_xiaoxiao","zf_xiaoyi","zm_yunjian","zm_yunxi","zm_yunxia","zm_yunyang"]},"created":1742418046},{"id":"tts-qwen3-0-6b","type":"tts","model_spec":{"privacy":"private","pricing":{"input":{"usd":87.5,"diem":87.5}},"traits":[],"name":"Qwen 3 TTS 0.6B","voices":["Aiden","Dylan","Eric","Ono_Anna","Ryan","Serena","Sohee","Uncle_Fu","Vivian"]},"created":1773100800},{"id":"tts-qwen3-1-7b","type":"tts","model_spec":{"privacy":"private","pricing":{"input":{"usd":112.5,"diem":112.5}},"traits":[],"name":"Qwen 3 TTS 1.7B","voices":["Aiden","Dylan","Eric","Ono_Anna","Ryan","Serena","Sohee","Uncle_Fu","Vivian"]},"created":1773100800},{"id":"text-embedding-bge-m3","type":"embedding","model_spec":{"privacy":"private","pricing":{"input":{"usd":0.15,"diem":0.15},"output":{"usd":0.6,"diem":0.6}},"traits":[],"name":"BGE-M3"},"created":1741924661},{"id":"ace-step-15","type":"music","model_spec":{"privacy":"anonymized","pricing":{"durations":{"60":{"usd":0.03,"diem":0.03},"90":{"usd":0.04,"diem":0.04},"120":{"usd":0.05,"diem":0.05},"150":{"usd":0.06,"diem":0.06},"180":{"usd":0.07,"diem":0.07},"210":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"ACE-Step 1.5"},"created":1771804800},{"id":"elevenlabs-tts-multilingual-v2","type":"music","model_spec":{"privacy":"anonymized","pricing":{"per_thousand_characters":{"usd":0.11500000000000002,"diem":0.11500000000000002}},"traits":[],"name":"ElevenLabs Multilingual v2","voices":["Aria","Roger","Sarah","Laura","Charlie","George","Callum","River","Liam","Charlotte","Alice","Matilda","Will","Jessica","Eric","Chris","Brian","Daniel","Lily","Bill"]},"created":1772236800},{"id":"elevenlabs-music","type":"music","model_spec":{"privacy":"anonymized","pricing":{"durations":{"60":{"usd":0.87,"diem":0.87},"120":{"usd":1.73,"diem":1.73},"180":{"usd":2.59,"diem":2.59},"240":{"usd":3.45,"diem":3.45}}},"traits":[],"name":"ElevenLabs Music"},"created":1771718400},{"id":"elevenlabs-sound-effects-v2","type":"music","model_spec":{"privacy":"anonymized","pricing":{"per_second":{"usd":0.0023000000000000004,"diem":0.0023000000000000004}},"traits":[],"name":"ElevenLabs Sound Effects"},"created":1772236800},{"id":"elevenlabs-tts-v3","type":"music","model_spec":{"privacy":"anonymized","pricing":{"per_thousand_characters":{"usd":0.11500000000000002,"diem":0.11500000000000002}},"traits":[],"name":"ElevenLabs TTS v3","voices":["Aria","Roger","Sarah","Laura","Charlie","George","Callum","River","Liam","Charlotte","Alice","Matilda","Will","Jessica","Eric","Chris","Brian","Daniel","Lily","Bill"]},"created":1772236800},{"id":"minimax-music-v2","type":"music","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.04,"diem":0.04}},"traits":[],"name":"MiniMax Music 2.0"},"created":1771718400},{"id":"mmaudio-v2-text-to-audio","type":"music","model_spec":{"privacy":"anonymized","pricing":{"per_second":{"usd":0.0009200000000000001,"diem":0.0009200000000000001}},"traits":[],"name":"MMAudio V2"},"created":1772236800},{"id":"stable-audio-25","type":"music","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.24,"diem":0.24}},"traits":[],"name":"Stable Audio 2.5"},"created":1771718400},{"id":"grok-imagine-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Grok Imagine"},"created":1769644800},{"id":"grok-imagine-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Grok Imagine"},"created":1769644800},{"id":"kling-2.5-turbo-pro-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling 2.5 Turbo Pro"},"created":1758825748},{"id":"kling-2.5-turbo-pro-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling 2.5 Turbo Pro"},"created":1758825748},{"id":"kling-2.6-pro-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling 2.6 Pro"},"created":1733186476},{"id":"kling-2.6-pro-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling 2.6 Pro"},"created":1733186476},{"id":"kling-o3-pro-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling O3 Pro"},"created":1770076800},{"id":"kling-o3-pro-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling O3 Pro"},"created":1770076800},{"id":"kling-o3-pro-reference-to-video","type":"video","model_spec":{"betaModel":true,"privacy":"anonymized","traits":[],"name":"Kling O3 Pro R2V"},"created":1773014400},{"id":"kling-o3-standard-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling O3 Standard"},"created":1770076800},{"id":"kling-o3-standard-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling O3 Standard"},"created":1770076800},{"id":"kling-o3-standard-reference-to-video","type":"video","model_spec":{"betaModel":true,"privacy":"anonymized","traits":[],"name":"Kling O3 Standard R2V"},"created":1773100800},{"id":"kling-v3-pro-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling V3 Pro"},"created":1770076800},{"id":"kling-v3-pro-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling V3 Pro"},"created":1770076800},{"id":"kling-v3-standard-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling V3 Standard"},"created":1770076800},{"id":"kling-v3-standard-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Kling V3 Standard"},"created":1770076800},{"id":"longcat-distilled-image-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"Longcat Distilled"},"created":1764806400},{"id":"longcat-distilled-text-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"Longcat Distilled"},"created":1764806400},{"id":"longcat-image-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"Longcat Full Quality"},"created":1764806400},{"id":"longcat-text-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"Longcat Full Quality"},"created":1764806400},{"id":"ltx-2-19b-full-text-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"LTX Video 2.0 19B"},"created":1767830400},{"id":"ltx-2-19b-full-image-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"LTX Video 2.0 19B"},"created":1767830400},{"id":"ltx-2-19b-distilled-text-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"LTX Video 2.0 19B Distilled"},"created":1767830400},{"id":"ltx-2-19b-distilled-image-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"LTX Video 2.0 19B Distilled"},"created":1767830400},{"id":"ltx-2-fast-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"LTX Video 2.0 Fast"},"created":1732684002},{"id":"ltx-2-fast-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"LTX Video 2.0 Fast"},"created":1732684002},{"id":"ltx-2-full-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"LTX Video 2.0 Full Quality"},"created":1732684002},{"id":"ltx-2-full-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"LTX Video 2.0 Full Quality"},"created":1732684002},{"id":"ltx-2-v2-3-fast-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"LTX Video 2.3 Fast"},"created":1772668800},{"id":"ltx-2-v2-3-fast-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"LTX Video 2.3 Fast"},"created":1772668800},{"id":"ltx-2-v2-3-full-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"LTX Video 2.3 Full Quality"},"created":1772668800},{"id":"ltx-2-v2-3-full-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"LTX Video 2.3 Full Quality"},"created":1772668800},{"id":"ovi-image-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"Ovi"},"created":1758825748},{"id":"pixverse-v5.6-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"PixVerse v5.6"},"created":1769472000},{"id":"pixverse-v5.6-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"PixVerse v5.6"},"created":1769472000},{"id":"pixverse-v5.6-transition","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"PixVerse v5.6 Transition"},"created":1769472000},{"id":"sora-2-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Sora 2"},"created":1758825748},{"id":"sora-2-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Sora 2"},"created":1758825748},{"id":"sora-2-pro-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Sora 2 Pro"},"created":1758825748},{"id":"sora-2-pro-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Sora 2 Pro"},"created":1758825748},{"id":"veo3-fast-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Veo 3 Fast"},"created":1758825748},{"id":"veo3-fast-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Veo 3 Fast"},"created":1758825748},{"id":"veo3-full-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Veo 3 Full Quality"},"created":1758825748},{"id":"veo3-full-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Veo 3 Full Quality"},"created":1758825748},{"id":"veo3.1-fast-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Veo 3.1 Fast"},"created":1729030447},{"id":"veo3.1-fast-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Veo 3.1 Fast"},"created":1729030447},{"id":"veo3.1-full-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Veo 3.1 Full Quality"},"created":1729030447},{"id":"veo3.1-full-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Veo 3.1 Full Quality"},"created":1729030447},{"id":"vidu-q3-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Vidu Q3"},"created":1769817600},{"id":"vidu-q3-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Vidu Q3"},"created":1769817600},{"id":"wan-2.1-pro-image-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"Wan 2.1 Pro"},"created":1758825748},{"id":"wan-2.2-a14b-text-to-video","type":"video","model_spec":{"privacy":"private","traits":[],"name":"Wan 2.2 A14B"},"created":1758825748},{"id":"wan-2.5-preview-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Wan 2.5 Preview"},"created":1758825748},{"id":"wan-2.5-preview-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Wan 2.5 Preview"},"created":1758825748},{"id":"wan-2.6-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Wan 2.6"},"created":1765843200},{"id":"wan-2.6-text-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Wan 2.6"},"created":1765843200},{"id":"wan-2.6-flash-image-to-video","type":"video","model_spec":{"privacy":"anonymized","traits":[],"name":"Wan 2.6 Flash"},"created":1768824000},{"id":"claude-opus-4-5","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":198000,"pricing":{"input":{"usd":6,"diem":6},"cache_input":{"usd":0.6,"diem":0.6},"cache_write":{"usd":7.5,"diem":7.5},"output":{"usd":30,"diem":30}},"traits":[],"name":"Claude Opus 4.5","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1764979200},{"id":"claude-opus-4-6","type":"text","model_spec":{"betaModel":true,"privacy":"anonymized","availableContextTokens":1000000,"pricing":{"input":{"usd":6,"diem":6},"cache_input":{"usd":0.6,"diem":0.6},"cache_write":{"usd":7.5,"diem":7.5},"output":{"usd":30,"diem":30}},"traits":[],"name":"Claude Opus 4.6","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1770249600},{"id":"claude-sonnet-4-5","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":198000,"pricing":{"input":{"usd":3.75,"diem":3.75},"cache_input":{"usd":0.375,"diem":0.375},"cache_write":{"usd":4.69,"diem":4.69},"output":{"usd":18.75,"diem":18.75}},"traits":[],"name":"Claude Sonnet 4.5","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1736899200},{"id":"claude-sonnet-4-6","type":"text","model_spec":{"betaModel":true,"privacy":"anonymized","availableContextTokens":1000000,"pricing":{"input":{"usd":3.6,"diem":3.6},"cache_input":{"usd":0.36,"diem":0.36},"cache_write":{"usd":4.5,"diem":4.5},"output":{"usd":18,"diem":18}},"traits":[],"name":"Claude Sonnet 4.6","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1771286400},{"id":"deepseek-v3.2","type":"text","model_spec":{"privacy":"private","availableContextTokens":160000,"pricing":{"input":{"usd":0.33,"diem":0.33},"cache_input":{"usd":0.16,"diem":0.16},"output":{"usd":0.48,"diem":0.48}},"traits":[],"name":"DeepSeek V3.2","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1764806400},{"id":"gemini-3-flash-preview","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":256000,"pricing":{"input":{"usd":0.7,"diem":0.7},"cache_input":{"usd":0.07,"diem":0.07},"output":{"usd":3.75,"diem":3.75}},"traits":[],"name":"Gemini 3 Flash Preview","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":true,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":true,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1766102400},{"id":"gemini-3-pro-preview","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":198000,"pricing":{"input":{"usd":2.5,"diem":2.5},"cache_input":{"usd":0.625,"diem":0.625},"output":{"usd":15,"diem":15}},"traits":[],"name":"Gemini 3 Pro Preview","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":true,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":true,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1764633600},{"id":"gemini-3-1-pro-preview","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":1000000,"pricing":{"input":{"usd":2.5,"diem":2.5},"cache_input":{"usd":0.5,"diem":0.5},"cache_write":{"usd":0.5,"diem":0.5},"output":{"usd":15,"diem":15},"extended":{"context_token_threshold":200000,"input":{"usd":5,"diem":5},"output":{"usd":22.5,"diem":22.5},"cache_input":{"usd":0.5,"diem":0.5},"cache_write":{"usd":0.5,"diem":0.5}}},"traits":[],"name":"Gemini 3.1 Pro Preview","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":true,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":20,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":true,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1771459200},{"id":"e2ee-gemma-3-27b-p","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":40000,"pricing":{"input":{"usd":0.14,"diem":0.14},"output":{"usd":0.5,"diem":0.5}},"traits":[],"name":"Gemma 3 27B","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"zai-org-glm-4.6","type":"text","model_spec":{"privacy":"private","availableContextTokens":198000,"pricing":{"input":{"usd":0.85,"diem":0.85},"cache_input":{"usd":0.3,"diem":0.3},"output":{"usd":2.75,"diem":2.75}},"traits":[],"name":"GLM 4.6","capabilities":{"optimizedForCode":false,"quantization":"fp4","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1711929600},{"id":"zai-org-glm-4.7","type":"text","model_spec":{"privacy":"private","availableContextTokens":198000,"pricing":{"input":{"usd":0.55,"diem":0.55},"cache_input":{"usd":0.11,"diem":0.11},"output":{"usd":2.65,"diem":2.65}},"traits":["default","most_intelligent","function_calling_default"],"name":"GLM 4.7","capabilities":{"optimizedForCode":false,"quantization":"fp4","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1766534400},{"id":"e2ee-glm-4-7-p","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":1.1,"diem":1.1},"output":{"usd":4.15,"diem":4.15}},"traits":[],"name":"GLM 4.7","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"zai-org-glm-4.7-flash","type":"text","model_spec":{"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.125,"diem":0.125},"output":{"usd":0.5,"diem":0.5}},"traits":[],"name":"GLM 4.7 Flash","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1769644800},{"id":"e2ee-glm-4-7-flash-p","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":198000,"pricing":{"input":{"usd":0.13,"diem":0.13},"output":{"usd":0.55,"diem":0.55}},"traits":[],"name":"GLM 4.7 Flash","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"olafangensan-glm-4.7-flash-heretic","type":"text","model_spec":{"privacy":"private","availableContextTokens":200000,"pricing":{"input":{"usd":0.14,"diem":0.14},"output":{"usd":0.8,"diem":0.8}},"traits":[],"name":"GLM 4.7 Flash Heretic","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1770163200},{"id":"zai-org-glm-5","type":"text","model_spec":{"privacy":"private","availableContextTokens":198000,"pricing":{"input":{"usd":1,"diem":1},"cache_input":{"usd":0.2,"diem":0.2},"output":{"usd":3.2,"diem":3.2}},"traits":[],"name":"GLM 5","capabilities":{"optimizedForCode":true,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1770768000},{"id":"e2ee-glm-5","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":198000,"pricing":{"input":{"usd":1.1,"diem":1.1},"output":{"usd":4.15,"diem":4.15}},"traits":[],"name":"GLM 5","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"google-gemma-3-27b-it","type":"text","model_spec":{"privacy":"private","availableContextTokens":198000,"pricing":{"input":{"usd":0.12,"diem":0.12},"output":{"usd":0.2,"diem":0.2}},"traits":[],"name":"Google Gemma 3 27B Instruct","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1762214400},{"id":"e2ee-gpt-oss-120b-p","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.13,"diem":0.13},"output":{"usd":0.65,"diem":0.65}},"traits":[],"name":"GPT OSS 120B","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"e2ee-gpt-oss-20b-p","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.05,"diem":0.05},"output":{"usd":0.19,"diem":0.19}},"traits":[],"name":"GPT OSS 20B","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"openai-gpt-4o-2024-11-20","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":128000,"pricing":{"input":{"usd":3.125,"diem":3.125},"output":{"usd":12.5,"diem":12.5}},"traits":[],"name":"GPT-4o","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":true,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1772236800},{"id":"openai-gpt-4o-mini-2024-07-18","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":128000,"pricing":{"input":{"usd":0.1875,"diem":0.1875},"cache_input":{"usd":0.09375,"diem":0.09375},"output":{"usd":0.75,"diem":0.75}},"traits":[],"name":"GPT-4o Mini","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":true,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1772236800},{"id":"openai-gpt-52","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":256000,"pricing":{"input":{"usd":2.19,"diem":2.19},"cache_input":{"usd":0.219,"diem":0.219},"output":{"usd":17.5,"diem":17.5}},"traits":[],"name":"GPT-5.2","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1765584000},{"id":"openai-gpt-52-codex","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":256000,"pricing":{"input":{"usd":2.19,"diem":2.19},"cache_input":{"usd":0.219,"diem":0.219},"output":{"usd":17.5,"diem":17.5}},"traits":[],"name":"GPT-5.2 Codex","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1736899200},{"id":"openai-gpt-53-codex","type":"text","model_spec":{"betaModel":true,"privacy":"anonymized","availableContextTokens":400000,"pricing":{"input":{"usd":2.19,"diem":2.19},"cache_input":{"usd":0.219,"diem":0.219},"output":{"usd":17.5,"diem":17.5}},"traits":[],"name":"GPT-5.3 Codex","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1771891200},{"id":"openai-gpt-54","type":"text","model_spec":{"betaModel":true,"privacy":"anonymized","availableContextTokens":1000000,"pricing":{"input":{"usd":3.13,"diem":3.13},"cache_input":{"usd":0.313,"diem":0.313},"output":{"usd":18.8,"diem":18.8}},"traits":[],"name":"GPT-5.4","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1772668800},{"id":"openai-gpt-54-pro","type":"text","model_spec":{"betaModel":true,"privacy":"anonymized","availableContextTokens":1000000,"pricing":{"input":{"usd":37.5,"diem":37.5},"output":{"usd":225,"diem":225},"extended":{"context_token_threshold":272000,"input":{"usd":75,"diem":75},"output":{"usd":337.5,"diem":337.5}}},"traits":[],"name":"GPT-5.4 Pro","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1772668800},{"id":"grok-41-fast","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":1000000,"pricing":{"input":{"usd":0.25,"diem":0.25},"cache_input":{"usd":0.0625,"diem":0.0625},"output":{"usd":0.625,"diem":0.625}},"traits":[],"name":"Grok 4.1 Fast","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1764547200},{"id":"grok-4-20-beta","type":"text","model_spec":{"betaModel":true,"privacy":"anonymized","availableContextTokens":2000000,"pricing":{"input":{"usd":2.5,"diem":2.5},"cache_input":{"usd":0.25,"diem":0.25},"output":{"usd":7.5,"diem":7.5},"extended":{"context_token_threshold":200000,"input":{"usd":5,"diem":5},"output":{"usd":15,"diem":15},"cache_input":{"usd":0.25,"diem":0.25}}},"traits":[],"name":"Grok 4.20 Beta","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":true}},"created":1773273600},{"id":"grok-4-20-multi-agent-beta","type":"text","model_spec":{"betaModel":true,"privacy":"anonymized","availableContextTokens":2000000,"pricing":{"input":{"usd":2.5,"diem":2.5},"cache_input":{"usd":0.25,"diem":0.25},"output":{"usd":7.5,"diem":7.5},"extended":{"context_token_threshold":200000,"input":{"usd":5,"diem":5},"output":{"usd":15,"diem":15},"cache_input":{"usd":0.25,"diem":0.25}}},"traits":[],"name":"Grok 4.20 Multi-Agent Beta","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":true}},"created":1773273600},{"id":"grok-code-fast-1","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":256000,"pricing":{"input":{"usd":0.25,"diem":0.25},"cache_input":{"usd":0.03,"diem":0.03},"output":{"usd":1.87,"diem":1.87}},"traits":[],"name":"Grok Code Fast 1","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":true,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1764547200},{"id":"hermes-3-llama-3.1-405b","type":"text","model_spec":{"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":1.1,"diem":1.1},"output":{"usd":3,"diem":3}},"traits":[],"name":"Hermes 3 Llama 3.1 405b","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1758758400},{"id":"kimi-k2-thinking","type":"text","model_spec":{"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.75,"diem":0.75},"cache_input":{"usd":0.375,"diem":0.375},"output":{"usd":3.2,"diem":3.2}},"traits":[],"name":"Kimi K2 Thinking","capabilities":{"optimizedForCode":true,"quantization":"int4","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1765324800},{"id":"kimi-k2-5","type":"text","model_spec":{"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.56,"diem":0.56},"cache_input":{"usd":0.11,"diem":0.11},"output":{"usd":3.5,"diem":3.5}},"traits":[],"name":"Kimi K2.5","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1769548800},{"id":"llama-3.2-3b","type":"text","model_spec":{"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.15,"diem":0.15},"output":{"usd":0.6,"diem":0.6}},"traits":[],"name":"Llama 3.2 3B","capabilities":{"optimizedForCode":false,"quantization":"fp16","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1727966436},{"id":"llama-3.3-70b","type":"text","model_spec":{"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.7,"diem":0.7},"output":{"usd":2.8,"diem":2.8}},"traits":[],"name":"Llama 3.3 70B","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1743897600},{"id":"minimax-m21","type":"text","model_spec":{"privacy":"private","availableContextTokens":198000,"pricing":{"input":{"usd":0.35,"diem":0.35},"cache_input":{"usd":0.04,"diem":0.04},"output":{"usd":1.5,"diem":1.5}},"traits":[],"name":"MiniMax M2.1","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":true,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1764547200},{"id":"minimax-m25","type":"text","model_spec":{"privacy":"private","availableContextTokens":198000,"pricing":{"input":{"usd":0.34,"diem":0.34},"cache_input":{"usd":0.04,"diem":0.04},"output":{"usd":1.19,"diem":1.19}},"traits":[],"name":"MiniMax M2.5","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":false,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1770854400},{"id":"minimax-m27","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":198000,"pricing":{"input":{"usd":0.375,"diem":0.375},"cache_input":{"usd":0.075,"diem":0.075},"output":{"usd":1.5,"diem":1.5}},"traits":[],"name":"MiniMax M2.7","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":true,"supportsResponseSchema":false,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"mistral-small-3-2-24b-instruct","type":"text","model_spec":{"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.09375,"diem":0.09375},"output":{"usd":0.25,"diem":0.25}},"traits":[],"name":"Mistral Small 3.2 24B Instruct","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1768435200},{"id":"nvidia-nemotron-3-nano-30b-a3b","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.075,"diem":0.075},"output":{"usd":0.3,"diem":0.3}},"traits":[],"name":"NVIDIA Nemotron 3 Nano 30B","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1769472000},{"id":"openai-gpt-oss-120b","type":"text","model_spec":{"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.07,"diem":0.07},"output":{"usd":0.3,"diem":0.3}},"traits":[],"name":"OpenAI GPT OSS 120B","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1762387200},{"id":"e2ee-qwen-2-5-7b-p","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":32000,"pricing":{"input":{"usd":0.05,"diem":0.05},"output":{"usd":0.13,"diem":0.13}},"traits":[],"name":"Qwen 2.5 7B","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"qwen3-235b-a22b-instruct-2507","type":"text","model_spec":{"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.15,"diem":0.15},"output":{"usd":0.75,"diem":0.75}},"traits":[],"name":"Qwen 3 235B A22B Instruct 2507","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1745903059},{"id":"qwen3-235b-a22b-thinking-2507","type":"text","model_spec":{"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.45,"diem":0.45},"output":{"usd":3.5,"diem":3.5}},"traits":["default_reasoning"],"name":"Qwen 3 235B A22B Thinking 2507","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1745903059},{"id":"qwen3-coder-480b-a35b-instruct","type":"text","model_spec":{"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.75,"diem":0.75},"output":{"usd":3,"diem":3}},"traits":["default_code"],"name":"Qwen 3 Coder 480b","capabilities":{"optimizedForCode":true,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1745903059},{"id":"qwen3-coder-480b-a35b-instruct-turbo","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.35,"diem":0.35},"cache_input":{"usd":0.04,"diem":0.04},"output":{"usd":1.5,"diem":1.5}},"traits":[],"name":"Qwen 3 Coder 480B Turbo","capabilities":{"optimizedForCode":true,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":true,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1769472000},{"id":"qwen3-next-80b","type":"text","model_spec":{"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.35,"diem":0.35},"output":{"usd":1.9,"diem":1.9}},"traits":[],"name":"Qwen 3 Next 80b","capabilities":{"optimizedForCode":false,"quantization":"fp16","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1745903059},{"id":"qwen3-5-35b-a3b","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.3125,"diem":0.3125},"cache_input":{"usd":0.15625,"diem":0.15625},"output":{"usd":1.25,"diem":1.25}},"traits":[],"name":"Qwen 3.5 35B A3B","capabilities":{"optimizedForCode":true,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":true,"supportsMultipleImages":true,"maxImages":5,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":true,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1771977600},{"id":"qwen3-5-9b","type":"text","model_spec":{"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.05,"diem":0.05},"output":{"usd":0.15,"diem":0.15}},"traits":[],"name":"Qwen 3.5 9B","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":true,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1772668800},{"id":"e2ee-qwen3-30b-a3b-p","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.19,"diem":0.19},"output":{"usd":0.69,"diem":0.69}},"traits":[],"name":"Qwen3 30B A3B","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"qwen3-vl-235b-a22b","type":"text","model_spec":{"privacy":"private","availableContextTokens":256000,"pricing":{"input":{"usd":0.25,"diem":0.25},"output":{"usd":1.5,"diem":1.5}},"traits":["default_vision"],"name":"Qwen3 VL 235B","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1768521600},{"id":"e2ee-qwen3-vl-30b-a3b-p","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.25,"diem":0.25},"output":{"usd":0.9,"diem":0.9}},"traits":[],"name":"Qwen3 VL 30B A3B","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"e2ee-qwen3-5-122b-a10b","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.5,"diem":0.5},"output":{"usd":4,"diem":4}},"traits":[],"name":"Qwen3.5 122B A10B","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"mistral-31-24b","type":"text","model_spec":{"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.5,"diem":0.5},"output":{"usd":2,"diem":2}},"traits":[],"name":"Venice Medium","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false},"deprecation":{"date":"2026-03-29T00:00:00.000Z"}},"created":1742262554},{"id":"venice-uncensored-role-play","type":"text","model_spec":{"privacy":"private","availableContextTokens":128000,"pricing":{"input":{"usd":0.5,"diem":0.5},"output":{"usd":2,"diem":2}},"traits":[],"name":"Venice Role Play Uncensored","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":false,"supportsMultipleImages":true,"maxImages":10,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":true,"supportsWebSearch":true,"supportsXSearch":false}},"created":1771545600},{"id":"qwen3-4b","type":"text","model_spec":{"privacy":"private","availableContextTokens":32000,"pricing":{"input":{"usd":0.05,"diem":0.05},"output":{"usd":0.15,"diem":0.15}},"traits":["fastest"],"name":"Venice Small","capabilities":{"optimizedForCode":false,"quantization":"fp8","supportsAudioInput":false,"supportsFunctionCalling":true,"supportsLogProbs":true,"supportsMultipleImages":false,"supportsReasoning":true,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false},"deprecation":{"date":"2026-03-29T00:00:00.000Z"}},"created":1745903059},{"id":"venice-uncensored","type":"text","model_spec":{"privacy":"private","availableContextTokens":32000,"pricing":{"input":{"usd":0.2,"diem":0.2},"output":{"usd":0.9,"diem":0.9}},"traits":["most_uncensored"],"name":"Venice Uncensored 1.1","capabilities":{"optimizedForCode":false,"quantization":"fp16","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":true,"supportsTeeAttestation":false,"supportsE2EE":false,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1742262554},{"id":"e2ee-venice-uncensored-24b-p","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":32000,"pricing":{"input":{"usd":0.25,"diem":0.25},"output":{"usd":1.15,"diem":1.15}},"traits":[],"name":"Venice Uncensored 1.1","capabilities":{"optimizedForCode":false,"quantization":"not-available","supportsAudioInput":false,"supportsFunctionCalling":false,"supportsLogProbs":false,"supportsMultipleImages":false,"supportsReasoning":false,"supportsReasoningEffort":false,"supportsResponseSchema":false,"supportsTeeAttestation":true,"supportsE2EE":true,"supportsVideoInput":false,"supportsVision":false,"supportsWebSearch":true,"supportsXSearch":false}},"created":1773792000},{"id":"nvidia/parakeet-tdt-0.6b-v3","type":"asr","model_spec":{"privacy":"private","pricing":{"per_audio_second":{"usd":0.0001,"diem":0.0001}},"traits":[],"name":"Parakeet ASR"},"created":1760136444},{"id":"openai/whisper-large-v3","type":"asr","model_spec":{"privacy":"private","pricing":{"per_audio_second":{"usd":0.0001,"diem":0.0001}},"traits":[],"name":"Whisper Large V3"},"created":1736899200},{"id":"upscaler","type":"upscale","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01,"diem":0.01},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Upscaler"},"created":1744453050},{"id":"wai-Illustrious","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01,"diem":0.01},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Anime (WAI)"},"created":1736635129},{"id":"bria-bg-remover","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.03,"diem":0.03},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Background Remover"},"created":1772064000},{"id":"chroma","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01,"diem":0.01},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Chroma"},"created":1769731200},{"id":"flux-2-max","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.09,"diem":0.09},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Flux 2 Max"},"created":1764086377},{"id":"flux-2-pro","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.04,"diem":0.04},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Flux 2 Pro"},"created":1764086377},{"id":"gpt-image-1-5","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.26,"diem":0.26},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"GPT Image 1.5"},"created":1765986864},{"id":"grok-imagine","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.04,"diem":0.04},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Grok Imagine"},"created":1769644800},{"id":"hidream","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01,"diem":0.01},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"HiDream"},"created":1747080729},{"id":"hunyuan-image-v3","type":"image","model_spec":{"betaModel":true,"privacy":"private","pricing":{"generation":{"usd":0.09,"diem":0.09},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Hunyuan Image 3.0"},"created":1772323200},{"id":"imagineart-1.5-pro","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.06,"diem":0.06},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"ImagineArt 1.5 Pro"},"created":1769437800},{"id":"lustify-sdxl","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01,"diem":0.01},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Lustify SDXL"},"created":1738704152},{"id":"lustify-v7","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01,"diem":0.01},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":["most_uncensored"],"name":"Lustify v7"},"created":1736635129},{"id":"nano-banana-2","type":"image","model_spec":{"privacy":"anonymized","pricing":{"resolutions":{"1K":{"usd":0.1,"diem":0.1},"2K":{"usd":0.14,"diem":0.14},"4K":{"usd":0.19,"diem":0.19}},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Nano Banana 2"},"created":1772064000},{"id":"nano-banana-pro","type":"image","model_spec":{"privacy":"anonymized","pricing":{"resolutions":{"1K":{"usd":0.18,"diem":0.18},"2K":{"usd":0.23,"diem":0.23},"4K":{"usd":0.35,"diem":0.35}},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Nano Banana Pro"},"created":1763653951},{"id":"qwen-image","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01,"diem":0.01},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":["highest_quality"],"name":"Qwen Image"},"created":1736635129},{"id":"qwen-image-2","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.05,"diem":0.05},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Qwen Image 2"},"created":1772582400},{"id":"qwen-image-2-pro","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.1,"diem":0.1},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Qwen Image 2 Pro"},"created":1772582400},{"id":"recraft-v4","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.05,"diem":0.05},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Recraft V4"},"created":1770854400},{"id":"recraft-v4-pro","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.29,"diem":0.29},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"Recraft V4 Pro"},"created":1770854400},{"id":"seedream-v4","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.05,"diem":0.05},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"SeedreamV4.5"},"created":1762383600},{"id":"seedream-v5-lite","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.05,"diem":0.05},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":[],"name":"SeedreamV5 Lite"},"created":1771804800},{"id":"venice-sd35","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01,"diem":0.01},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":["eliza-default"],"name":"Venice SD35"},"created":1743099022},{"id":"z-image-turbo","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01,"diem":0.01},"upscale":{"2x":{"usd":0.02,"diem":0.02},"4x":{"usd":0.08,"diem":0.08}}},"traits":["default","fastest"],"name":"Z-Image Turbo"},"created":1764758779}];
  
  // Privacy types that are always private (no API privacy field needed)
  const PRIVATE_TYPES = new Set(['upscale']);

  // Rate limit tiers - default limits by model size category
  // Models not listed default to their type's standard tier
  const RATE_LIMIT_TIERS = {
    xsmall: { rpm: 500, tpm: 1000000, label: 'XS', tooltip: 'Rate Limit: 500 RPM · 1M TPM' },
    small:  { rpm: 75,  tpm: 750000,  label: 'S',  tooltip: 'Rate Limit: 75 RPM · 750K TPM' },
    medium: { rpm: 50,  tpm: 750000,  label: 'M',  tooltip: 'Rate Limit: 50 RPM · 750K TPM' },
    large:  { rpm: 20,  tpm: 500000,  label: 'L',  tooltip: 'Rate Limit: 20 RPM · 500K TPM' }
  };

  // Model to rate limit tier mapping (text/embedding models only)
  const MODEL_RATE_LIMIT_TIER = {
    // XSmall - fastest/smallest models
    'qwen3-4b': 'xsmall',
    'llama-3.2-3b': 'xsmall',
    'text-embedding-bge-m3': 'xsmall',
    // Small - efficient mid-size models
    'mistral-31-24b': 'small',
    'venice-uncensored': 'small',
    // Medium - capable models
    'llama-3.3-70b': 'medium',
    'qwen3-next-80b': 'medium',
    'google-gemma-3-27b-it': 'medium',
    // Large - flagship models (default for unknown text models)
    'qwen3-235b': 'large',
    'qwen3-235b-a22b-instruct-2507': 'large',
    'qwen3-235b-a22b-thinking-2507': 'large',
    'grok-41-fast': 'large',
    'kimi-k2-thinking': 'large',
    'gemini-3-pro-preview': 'large',
    'hermes-3-llama-3.1-405b': 'large',
    'qwen3-coder-480b-a35b-instruct': 'large',
    'zai-org-glm-4.7': 'large',
    'openai-gpt-oss-120b': 'large'
  };

  function getModelRateLimitTier(modelId, modelType) {
    if (modelType !== 'text' && modelType !== 'embedding') return null;
    return MODEL_RATE_LIMIT_TIER[modelId] || 'large'; // Default to large for unknown text models
  }

  // Video model display configuration (can't be detected from API)
  // - audioPricing: show audio toggle (price differs with audio on/off)
  // - resPricing: false = hide resolution dropdown (price same at all resolutions)
  // Note: audio_configurable in API just means toggle exists, not that price changes
  const VIDEO_MODEL_CONFIG = {
    // Veo 3.1 - audio toggle available, resolution doesn't affect price
    'veo3.1-fast-text-to-video': { audioPricing: true, resPricing: false },
    'veo3.1-full-text-to-video': { audioPricing: true, resPricing: false },
    'veo3.1-fast-image-to-video': { resPricing: false },
    'veo3.1-full-image-to-video': { resPricing: false },
    // Veo 3 - no audio toggle, resolution doesn't affect price
    'veo3-fast-text-to-video': { resPricing: false },
    'veo3-full-text-to-video': { resPricing: false },
    'veo3-fast-image-to-video': { resPricing: false },
    'veo3-full-image-to-video': { resPricing: false },
    // Kling 2.6 Pro - audio toggle available
    'kling-2.6-pro-text-to-video': { audioPricing: true },
    // Sora 2 (non-Pro) - only has 720p, resolution doesn't matter
    'sora-2-text-to-video': { resPricing: false },
    'sora-2-image-to-video': { resPricing: false },
  };
  
  function getVideoModelConfig(modelId) {
    return VIDEO_MODEL_CONFIG[modelId] || {};
  }

  const videoQuoteCache = new Map();

  function getAspectRatios(constraints) {
    const ar = constraints.aspect_ratios;
    if (!ar) return [];
    if (Array.isArray(ar)) return ar;
    if (typeof ar === 'string') return [ar];
    return [];
  }

  function isFixedPriceModel(modelId, model) {
    if (!model) return false;
    
    const constraints = model.model_spec?.constraints || {};
    const config = getVideoModelConfig(modelId);
    const durations = constraints.durations || [];
    const resolutions = constraints.resolutions || [];
    const resPricing = config.resPricing !== false;
    
    // Fixed if: single duration AND (single/no resolution OR resolution doesn't affect price)
    return durations.length <= 1 && (resolutions.length <= 1 || !resPricing);
  }

  // Placeholder image for I2V quote requests (price is same regardless of image content)
  const PLACEHOLDER_IMAGE_URL = 'https://venice.ai/favicon.ico';

  // Circuit breaker: stop fetching video quotes after repeated CORS/network failures
  let videoQuoteFailures = 0;
  const VIDEO_QUOTE_MAX_FAILURES = 2;

  async function fetchVideoQuote(modelId, model, { resolution, duration, audio } = {}) {
    // Circuit breaker: if we've hit too many failures (likely CORS), stop trying
    if (videoQuoteFailures >= VIDEO_QUOTE_MAX_FAILURES) {
      return null;
    }

    const constraints = model.model_spec?.constraints || {};
    const isImageToVideo = constraints.model_type === 'image-to-video';
    
    const effectiveDuration = duration || constraints.durations?.[0] || '5s';
    const aspectRatios = getAspectRatios(constraints);
    const aspectRatio = aspectRatios[0];
    
    const cacheKey = `${modelId}:${resolution || 'default'}:${effectiveDuration}:${audio ?? 'default'}`;
    if (videoQuoteCache.has(cacheKey)) {
      return videoQuoteCache.get(cacheKey);
    }

    const body = { model: modelId, prompt: 'quote' };
    if (isImageToVideo) body.image_url = PLACEHOLDER_IMAGE_URL;
    if (resolution) body.resolution = resolution;
    if (effectiveDuration) body.duration = effectiveDuration;
    if (aspectRatio) body.aspect_ratio = aspectRatio;
    // Only send audio if explicitly set (true/false), not undefined
    if (typeof audio === 'boolean') body.audio = audio;

    try {
      const res = await fetch('https://api.venice.ai/api/v1/video/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        videoQuoteFailures++;
        return null;
      }
      // Reset failures on success
      videoQuoteFailures = 0;
      const data = await res.json();
      videoQuoteCache.set(cacheKey, data.quote);
      return data.quote;
    } catch {
      videoQuoteFailures++;
      return null;
    }
  }

  // Filter categories
  const CAPABILITY_FILTERS = ['reasoning', 'vision', 'function', 'code'];
  const VIDEO_FILTERS = ['text-to-video', 'image-to-video'];
  const IMAGE_FILTERS = ['image-gen', 'image-upscale', 'image-edit', 'image-uncensored'];
  const PRIVACY_FILTERS = ['e2ee', 'tee', 'private', 'anonymized'];

  // Tooltip text
  const TOOLTIPS = {
    e2ee: 'Private model with end-to-end encryption. Your prompt is encrypted in your browser and only decrypted inside a hardware-secured enclave (TEE). The response is encrypted before leaving the enclave. No prompt data is ever accessible to Venice or the infrastructure provider.',
    tee: 'Private model running in a Trusted Execution Environment (TEE). Inference runs inside a hardware-secured enclave with cryptographic attestation. No prompt data is stored or accessible outside the enclave.',
    private: 'Private model with zero data retention. No prompt data is stored or shared with any third party.',
    anonymized: 'The model provider may retain prompt data, though it is anonymized by Venice. For sensitive content, use a Private, TEE, or E2EE model.',
    beta: 'Experimental model that may change or be removed without notice. Not recommended for production.',
    deprecated: 'This model is scheduled for removal. See the deprecations page for timeline and migration guide.',
    uncensored: 'Responds to all prompts without content-based refusals or filtering.',
    upgraded: 'A newer version of this model is available with improved performance.',
    content_moderation: 'This model applies upstream content moderation. Requests blocked by the provider\u2019s filters are still billed at the full rate.'
  };

  // Models subject to upstream provider content moderation that still bills on blocked requests
  const CONTENT_MODERATED_MODELS = new Set([
    'grok-imagine',
    'grok-imagine-edit',
    'grok-imagine-text-to-video',
    'grok-imagine-image-to-video'
  ]);

  function hasContentModeration(modelId) {
    return CONTENT_MODERATED_MODELS.has(modelId);
  }

  let isInitializing = false;

  // Helpers
  function formatContext(tokens) {
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M';
    if (tokens >= 1000) return Math.round(tokens / 1000) + 'K';
    return tokens;
  }

  function formatAddedDate(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Format: "Jan 15, 2025"
    const dateStr = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    
    // New models (< 30 days) get a "NEW" badge
    const isNew = diffDays <= 30;
    
    return { dateStr, isNew };
  }

  function formatPrice(price) {
    if (price === null || price === undefined) return '-';
    if (price < 0.01 && price > 0) return '$' + price.toFixed(4);
    return '$' + price.toFixed(2);
  }

  function formatVideoPricing(modelId, model) {
    const isFixed = isFixedPriceModel(modelId, model);
    const prefix = isFixed ? '<span class="vmb-fixed-label">FIXED</span> ' : '';
    return `${prefix}<span class="vmb-video-price" data-model="${modelId}">Variable</span>`;
  }

  async function updateVideoPrice(modelId, model, { resolution, duration, audio } = {}, container) {
    const priceEl = (container || document).querySelector(`.vmb-video-price[data-model="${modelId}"]`);
    if (!priceEl) return;
    
    const price = await fetchVideoQuote(modelId, model, { resolution, duration, audio });
    
    if (price !== null) {
      priceEl.textContent = formatPrice(price);
    } else {
      priceEl.textContent = 'Variable';
    }
  }

  // Capability icons (simple SVG line icons)
  const CAP_ICONS = {
    // Plug icon - connects to external tools/APIs
    function: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>',
    // Brain icon - thinking/reasoning
    reasoning: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M12 18v-5"/></svg>',
    // Eye icon - vision/image understanding
    vision: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    // Code brackets - optimized for coding
    code: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
  };

  function getCapabilities(caps) {
    if (!caps) return [];
    const list = [];
    if (caps.supportsFunctionCalling) list.push('Function Calling');
    if (caps.supportsReasoning) list.push('Reasoning');
    if (caps.supportsVision) list.push('Vision');
    if (caps.optimizedForCode) list.push('Code');
    return list;
  }

  function getCapabilityIcons(caps) {
    if (!caps) return '';
    const icons = [];
    if (caps.supportsFunctionCalling) icons.push(`<span class="vmb-cap vmb-tooltip" data-tooltip="Function Calling">${CAP_ICONS.function}</span>`);
    if (caps.supportsReasoning) icons.push(`<span class="vmb-cap vmb-tooltip" data-tooltip="Reasoning">${CAP_ICONS.reasoning}</span>`);
    if (caps.supportsVision) icons.push(`<span class="vmb-cap vmb-tooltip" data-tooltip="Vision">${CAP_ICONS.vision}</span>`);
    if (caps.optimizedForCode) icons.push(`<span class="vmb-cap vmb-tooltip" data-tooltip="Code Optimized">${CAP_ICONS.code}</span>`);
    if (icons.length === 0) return '';
    return `<span class="vmb-caps">${icons.join('')}</span>`;
  }

  function getCapabilityTags(caps, isUncensored) {
    const tags = [];
    if (caps?.supportsFunctionCalling) {
      tags.push(`<span class="vpt-cap vpt-tooltip" data-tooltip="Function Calling">${CAP_ICONS.function}</span>`);
    }
    if (caps?.supportsReasoning) {
      tags.push(`<span class="vpt-cap vpt-tooltip" data-tooltip="Reasoning">${CAP_ICONS.reasoning}</span>`);
    }
    if (caps?.supportsVision) {
      tags.push(`<span class="vpt-cap vpt-tooltip" data-tooltip="Vision">${CAP_ICONS.vision}</span>`);
    }
    if (caps?.optimizedForCode) {
      tags.push(`<span class="vpt-cap vpt-tooltip" data-tooltip="Code Optimized">${CAP_ICONS.code}</span>`);
    }
    if (isUncensored) {
      tags.push('<span class="vpt-cap-tag vpt-cap-uncensored">Uncensored</span>');
    }
    return tags.join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isUncensoredModel(model) {
    const spec = model.model_spec || {};
    const traits = spec.traits || [];
    const modelId = model.id.toLowerCase();
    return traits.includes('most_uncensored') || 
           modelId.includes('uncensored') || 
           modelId.includes('lustify');
  }

  function isAnonymizedModel(model) {
    if (PRIVATE_TYPES.has(model.type)) return false;
    return model.model_spec?.privacy === 'anonymized';
  }

  function isE2EEModel(model) {
    const caps = model.model_spec?.capabilities || {};
    const modelId = (model.id || '').toLowerCase();
    return caps.supportsE2EE === true || modelId.startsWith('e2ee-');
  }

  function isTEEModel(model) {
    const caps = model.model_spec?.capabilities || {};
    const modelId = (model.id || '').toLowerCase();
    return caps.supportsTeeAttestation === true || modelId.startsWith('tee-') || isE2EEModel(model);
  }

  function getPrivacyTag(model, variant) {
    // variant: 'vmb' for main model browser, 'vpt' for pricing tables
    const cls = variant === 'vpt' ? 'vpt-cap-tag' : 'vmb-privacy-badge';
    const tipCls = variant === 'vpt' ? 'vpt-tooltip' : 'vmb-tooltip';
    if (isE2EEModel(model)) {
      return `<span class="${cls} ${tipCls} e2ee" data-tooltip="${TOOLTIPS.e2ee}">E2EE</span><span class="${cls} ${tipCls} private" data-tooltip="${TOOLTIPS.private}">Private</span>`;
    }
    if (isTEEModel(model)) {
      return `<span class="${cls} ${tipCls} tee" data-tooltip="${TOOLTIPS.tee}">TEE</span><span class="${cls} ${tipCls} private" data-tooltip="${TOOLTIPS.private}">Private</span>`;
    }
    if (isAnonymizedModel(model)) {
      return `<span class="${cls} ${tipCls} anonymized" data-tooltip="${TOOLTIPS.anonymized}">Anonymized</span>`;
    }
    return `<span class="${cls} ${tipCls} private" data-tooltip="${TOOLTIPS.private}">Private</span>`;
  }

  function isBetaModel(model) {
    return model.model_spec?.betaModel === true;
  }

  function isDeprecatedModel(model) {
    return model.model_spec?.deprecation?.date != null;
  }

  // Models that have been superseded by a newer version
  const UPGRADED_MODELS = new Set([]);

  function isUpgradedModel(model) {
    return UPGRADED_MODELS.has(model.id);
  }

  function matchesCodeFilter(model) {
    const spec = model.model_spec || {};
    const modelId = model.id.toLowerCase();
    return (spec.capabilities && spec.capabilities.optimizedForCode) || 
           modelId.includes('coder') || 
           modelId.includes('grok');
  }

  // Cache helpers
  function getCachedModels() {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function setCachedModels(models) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: models,
        timestamp: Date.now()
      }));
    } catch {
      // Storage full or disabled
    }
  }

  async function fetchModelsFromAPI() {
    const fetchPromises = MODEL_TYPES.map(type => 
      fetch(`${API_BASE}?type=${type}`)
        .then(r => {
          if (!r.ok) throw new Error(`API returned ${r.status}`);
          return r.json();
        })
        .catch(() => ({ data: [] }))
    );
    const results = await Promise.all(fetchPromises);
    const rawModels = results.flatMap(r => r.data || []);
    
    // Deduplicate by model ID
    const seen = new Set();
    const models = rawModels.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    setCachedModels(models);
    return models;
  }

  // ========== PRICING TABLE FUNCTIONS ==========

  // Copy button for pricing tables
  const copyIcon = `<svg class="copy-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const checkIcon = `<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
  function pricingCopyBtn(modelId) {
    return `<button class="vpt-copy-btn" data-model-id="${modelId}" title="Copy">${copyIcon}${checkIcon}</button>`;
  }

  function renderPricingChatTable(models) {
    const chatModels = models
      .filter(m => m.type === 'text')
      .filter(m => !isDeprecatedModel(m));

    if (chatModels.length === 0) return '<p>No models available.</p>';

    const rows = chatModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const name = escapeHtml(spec.name || model.id);
      const modelId = escapeHtml(model.id);
      const inputPrice = formatPrice(pricing.input?.usd);
      const outputPrice = formatPrice(pricing.output?.usd);
      const cacheReadStr = pricing.cache_input?.usd ? formatPrice(pricing.cache_input.usd) : null;
      const cacheWriteStr = pricing.cache_write?.usd ? formatPrice(pricing.cache_write.usd) : null;
      const contextWindow = spec.availableContextTokens || spec.constraints?.maxContextTokens;
      const contextStr = contextWindow ? (contextWindow >= 1000 ? `${Math.round(contextWindow / 1000)}K` : contextWindow) : null;
      const capTags = getCapabilityTags(spec.capabilities, isUncensoredModel(model));
      const betaTag = isBetaModel(model) ? '<span class="vpt-badge vpt-beta vpt-tooltip" data-tooltip="Experimental model that may change or be removed without notice.">Beta</span>' : '';
      const upgradedTag = isUpgradedModel(model) ? '<span class="vpt-badge vpt-upgraded vpt-tooltip" data-tooltip="A newer version of this model is available with improved performance.">Upgraded</span>' : '';
      const moderationTag = hasContentModeration(model.id) ? `<span class="vpt-badge vpt-moderation vpt-tooltip" data-tooltip="${TOOLTIPS.content_moderation}">Moderated</span>` : '';
      const privacyTag = getPrivacyTag(model, 'vpt');

      let priceItems = `
        <span class="vpt-price-item"><span class="vpt-price-label">Input Price</span><span class="vpt-price-value">${inputPrice}</span></span>
        <span class="vpt-price-item"><span class="vpt-price-label">Output Price</span><span class="vpt-price-value">${outputPrice}</span></span>
      `;
      if (cacheReadStr) {
        priceItems += `<span class="vpt-price-item vpt-tooltip" data-tooltip="Discounted rate for cached input tokens."><span class="vpt-price-label">Cache Read</span><span class="vpt-price-value">${cacheReadStr}</span></span>`;
      }
      if (cacheWriteStr) {
        priceItems += `<span class="vpt-price-item vpt-tooltip" data-tooltip="Cost to write tokens to cache."><span class="vpt-price-label">Cache Write</span><span class="vpt-price-value">${cacheWriteStr}</span></span>`;
      }

      let extendedLine = '';
      if (pricing.extended) {
        const ext = pricing.extended;
        const thresholdStr = ext.context_token_threshold >= 1000 ? `${Math.round(ext.context_token_threshold / 1000)}K` : ext.context_token_threshold;
        extendedLine = `<div class="vpt-extended-line vpt-tooltip" data-tooltip="This model uses higher rates when your prompt exceeds ${thresholdStr} tokens.">&gt;${thresholdStr} context: ${formatPrice(ext.input?.usd)}/M input · ${formatPrice(ext.output?.usd)}/M output`;
        if (ext.cache_input?.usd && ext.cache_write?.usd) {
          extendedLine += ` · ${formatPrice(ext.cache_input.usd)}/${formatPrice(ext.cache_write.usd)} cache`;
        } else if (ext.cache_input?.usd) {
          extendedLine += ` · ${formatPrice(ext.cache_input.usd)} cache`;
        }
        extendedLine += `</div>`;
      }

      return `<div class="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}${isUpgradedModel(model) ? ' vpt-upgraded-row' : ''}">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>${betaTag}${upgradedTag}
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${moderationTag}${privacyTag}${capTags}</div>
        </div>
        <div class="vpt-row-bottom">
          ${priceItems}
          ${contextStr ? `<span class="vpt-price-item vpt-context-right"><span class="vpt-price-label">Context</span><span class="vpt-price-value vpt-context-value">${contextStr}</span></span>` : ''}
        </div>
        ${extendedLine}
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingEmbeddingTable(models) {
    const embModels = models.filter(m => m.type === 'embedding').filter(m => !isDeprecatedModel(m));
    if (embModels.length === 0) return '<p>No models available.</p>';

    const rows = embModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = getPrivacyTag(model, 'vpt');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Input (per 1M tokens)</span><span class="vpt-price-value">${formatPrice(pricing.input?.usd)}</span></span>
          <span class="vpt-price-item"><span class="vpt-price-label">Output (per 1M tokens)</span><span class="vpt-price-value">${formatPrice(pricing.output?.usd)}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function formatResolutionPricingDropdown(modelId, resolutions, defaultRes) {
    if (!resolutions) return '';
    const keys = Object.keys(resolutions);
    const def = defaultRes || keys[0];
    const options = keys.map(res => 
      `<option value="${res}"${res === def ? ' selected' : ''}>${res}</option>`
    ).join('');
    const defaultPrice = resolutions[def]?.usd;
    return `<span class="vpt-res-group"><select class="vpt-res-select" data-model="${modelId}">${options}</select><span class="vpt-price-value vpt-res-price" data-model="${modelId}">${formatPrice(defaultPrice)}</span></span>`;
  }

  function renderPricingImageTable(models) {
    const imageModels = models.filter(m => m.type === 'image').filter(m => !isDeprecatedModel(m))
      .sort((a, b) => {
        const aBeta = isBetaModel(a) ? 1 : 0;
        const bBeta = isBetaModel(b) ? 1 : 0;
        if (aBeta !== bBeta) return aBeta - bBeta;
        const priceA = a.model_spec?.pricing?.generation?.usd || a.model_spec?.pricing?.resolutions?.['1K']?.usd || 0;
        const priceB = b.model_spec?.pricing?.generation?.usd || b.model_spec?.pricing?.resolutions?.['1K']?.usd || 0;
        return priceB - priceA;
      });
    if (imageModels.length === 0) return '<p>No models available.</p>';

    const rows = imageModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const betaTag = isBetaModel(model) ? '<span class="vpt-badge vpt-beta vpt-tooltip" data-tooltip="Experimental model that may change or be removed without notice.">Beta</span>' : '';
      const moderationTag = hasContentModeration(model.id) ? `<span class="vpt-badge vpt-moderation vpt-tooltip" data-tooltip="${TOOLTIPS.content_moderation}">Moderated</span>` : '';
      const privacyTag = getPrivacyTag(model, 'vpt');
      const resPricing = spec.pricing?.resolutions;
      const defaultRes = spec.constraints?.defaultResolution;
      
      let priceItems = '';
      if (resPricing) {
        // Show each resolution price separately
        const resKeys = Object.keys(resPricing);
        priceItems = resKeys.map(res => 
          `<span class="vpt-price-item"><span class="vpt-price-label">${res}</span><span class="vpt-price-value">${formatPrice(resPricing[res]?.usd)}</span></span>`
        ).join('');
      } else {
        priceItems = `<span class="vpt-price-item"><span class="vpt-price-label">Per Image</span><span class="vpt-price-value">${formatPrice(spec.pricing?.generation?.usd)}</span></span>`;
      }

      return `<div class="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>${betaTag}
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${moderationTag}${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          ${priceItems}
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingUpscaleTable(models) {
    const upscaleModels = models.filter(m => m.type === 'upscale').filter(m => !isDeprecatedModel(m));
    if (upscaleModels.length === 0) return '<p>No models available.</p>';

    const pricing = upscaleModels[0]?.model_spec?.pricing || {};
    const upscalePricing = pricing.upscale || pricing;
    const items = [];
    if (upscalePricing['2x']?.usd) items.push(`<span class="vpt-price-item"><span class="vpt-price-label">2x Upscale</span><span class="vpt-price-value">${formatPrice(upscalePricing['2x'].usd)}</span></span>`);
    if (upscalePricing['4x']?.usd) items.push(`<span class="vpt-price-item"><span class="vpt-price-label">4x Upscale</span><span class="vpt-price-value">${formatPrice(upscalePricing['4x'].usd)}</span></span>`);
    if (items.length === 0) return '<p>Upscaling pricing varies.</p>';

    return `<div class="vpt-list">
      <div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">Image Upscaler</span>
            <code class="vpt-model-id">upscaler</code>${pricingCopyBtn('upscaler')}
          </div>
        </div>
        <div class="vpt-row-bottom">${items.join('')}</div>
      </div>
    </div>`;
  }

  function renderPricingEditTable(models) {
    const editModels = models.filter(m => m.id === 'qwen-image' || m.type === 'inpaint').filter(m => !isDeprecatedModel(m));
    if (editModels.length === 0) return '<p>No models available.</p>';

    const rows = editModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const editPrice = spec.pricing?.inpaint?.usd ?? spec.pricing?.generation?.usd ?? 0.04;
      const moderationTag = hasContentModeration(model.id) ? `<span class="vpt-badge vpt-moderation vpt-tooltip" data-tooltip="${TOOLTIPS.content_moderation}">Moderated</span>` : '';

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${moderationTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per Edit</span><span class="vpt-price-value">${formatPrice(editPrice)}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingTTSTable(models) {
    const ttsModels = models.filter(m => m.type === 'tts').filter(m => !isDeprecatedModel(m));
    if (ttsModels.length === 0) return '<p>No models available.</p>';

    const rows = ttsModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = getPrivacyTag(model, 'vpt');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1M Characters</span><span class="vpt-price-value">${formatPrice(spec.pricing?.input?.usd)}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingASRTable(models) {
    const asrModels = models.filter(m => m.type === 'asr').filter(m => !isDeprecatedModel(m));
    if (asrModels.length === 0) return '';

    const rows = asrModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const price = pricing.per_audio_second?.usd ? formatPrice(pricing.per_audio_second.usd) : formatPrice(pricing.input?.usd);
      const privacyTag = getPrivacyTag(model, 'vpt');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per Audio Second</span><span class="vpt-price-value">${price}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function getPricingMusicModels(models, pricingKey) {
    return models
      .filter(m => m.type === 'music')
      .filter(m => !isDeprecatedModel(m))
      .filter(m => m.model_spec?.pricing?.[pricingKey])
      .sort((a, b) => (a.model_spec?.name || a.id).localeCompare(b.model_spec?.name || b.id));
  }

  function renderPricingMusicDurationTable(models) {
    const musicModels = getPricingMusicModels(models, 'durations');
    if (musicModels.length === 0) return '';

    const rows = musicModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = getPrivacyTag(model, 'vpt');
      const durationPricing = Object.entries(spec.pricing?.durations || {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([duration, price]) =>
          `<span class="vpt-price-item"><span class="vpt-price-label">${duration}s</span><span class="vpt-price-value">${formatPrice(price?.usd)}</span></span>`
        )
        .join('');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          ${durationPricing}
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingMusicGenerationTable(models) {
    const musicModels = getPricingMusicModels(models, 'generation');
    if (musicModels.length === 0) return '';

    const rows = musicModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = getPrivacyTag(model, 'vpt');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per Generation</span><span class="vpt-price-value">${formatPrice(spec.pricing?.generation?.usd)}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingMusicPerSecondTable(models) {
    const musicModels = getPricingMusicModels(models, 'per_second');
    if (musicModels.length === 0) return '';

    const rows = musicModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = getPrivacyTag(model, 'vpt');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per Second</span><span class="vpt-price-value">${formatPrice(spec.pricing?.per_second?.usd)}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingWebSearchTable() {
    return `<div class="vpt-list">
      <div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">Web Search</span>
            <code class="vpt-model-id">enable_web_search: true</code>${pricingCopyBtn('enable_web_search: true')}
          </div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1K Calls</span><span class="vpt-price-value">$10.00</span></span>
        </div>
      </div>
      <div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">Web Scraping</span>
            <code class="vpt-model-id">enable_web_scraping: true</code>${pricingCopyBtn('enable_web_scraping: true')}
          </div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1K URLs</span><span class="vpt-price-value">$10.00</span></span>
        </div>
      </div>
      <div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">X Search (xAI)</span>
            <code class="vpt-model-id">enable_x_search: true</code>${pricingCopyBtn('enable_x_search: true')}
          </div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1K Results</span><span class="vpt-price-value">$10.00</span></span>
        </div>
      </div>
    </div>`;
  }

  function renderPricingVideoTable(models) {
    const videoModels = models.filter(m => m.type === 'video').filter(m => !isDeprecatedModel(m))
      .sort((a, b) => {
        const aName = a.model_spec?.name || a.id;
        const bName = b.model_spec?.name || b.id;
        return aName.localeCompare(bName);
      });
    if (videoModels.length === 0) return '<p>No video models available.</p>';

    const rows = videoModels.map(model => {
      const spec = model.model_spec || {};
      const constraints = spec.constraints || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const betaTag = isBetaModel(model) ? '<span class="vpt-badge vpt-beta vpt-tooltip" data-tooltip="Experimental model that may change or be removed without notice.">Beta</span>' : '';
      const moderationTag = hasContentModeration(model.id) ? `<span class="vpt-badge vpt-moderation vpt-tooltip" data-tooltip="${TOOLTIPS.content_moderation}">Moderated</span>` : '';
      const privacyTag = getPrivacyTag(model, 'vpt');
      const videoType = constraints.model_type === 'image-to-video' ? 'Image to Video' : 'Text to Video';
      const videoTypeBadge = `<span class="vpt-cap-tag">${videoType}</span>`;
      const durations = constraints.durations || [];
      const resolutions = constraints.resolutions || [];

      return `<div class="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}" data-video-model="${modelId}">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>${betaTag}
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${moderationTag}${privacyTag}${videoTypeBadge}</div>
        </div>
        <div class="vpt-row-bottom">
          ${durations.length > 0 ? `<span class="vpt-price-item"><span class="vpt-price-label">Durations</span><span class="vpt-price-value vpt-context-value">${durations.join(', ')}</span></span>` : ''}
          ${resolutions.length > 0 ? `<span class="vpt-price-item"><span class="vpt-price-label">Resolutions</span><span class="vpt-price-value vpt-context-value">${resolutions.join(', ')}</span></span>` : ''}
          <span class="vpt-price-item"><span class="vpt-price-label">Starting At</span><span class="vpt-price-value vmb-video-price" data-model="${modelId}">Variable</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list vpt-video-list">${rows}</div>`;
  }

  async function updateVideoPricesForPricingPage(models) {
    const videoModels = models.filter(m => m.type === 'video').filter(m => !isDeprecatedModel(m));
    for (const model of videoModels) {
      const constraints = model.model_spec?.constraints || {};
      // Skip if no constraints (static data doesn't have them)
      if (!constraints.resolutions && !constraints.durations) continue;
      const defaultRes = constraints.resolutions?.[0];
      const defaultDur = constraints.durations?.[0];
      await updateVideoPrice(model.id, model, { resolution: defaultRes, duration: defaultDur });
    }
  }

  function formatDeprecationDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getDeprecationStatus(deprecationDate) {
    if (!deprecationDate) return null;
    const now = new Date();
    const depDate = new Date(deprecationDate);
    const thirtyDaysAfter = new Date(depDate);
    thirtyDaysAfter.setDate(thirtyDaysAfter.getDate() + 30);
    
    if (now < depDate) return 'retiring';
    if (now <= thirtyDaysAfter) return 'deprecated';
    return 'expired'; // More than 30 days past deprecation date
  }

  function renderDeprecationTable(models) {
    const deprecatingModels = models
      .filter(m => {
        const status = getDeprecationStatus(m.model_spec?.deprecation?.date);
        return status === 'retiring' || status === 'deprecated';
      })
      .sort((a, b) => new Date(a.model_spec?.deprecation?.date || 0) - new Date(b.model_spec?.deprecation?.date || 0));

    if (deprecatingModels.length === 0) {
      return `<table class="vpt-table vpt-deprecation-table"><thead><tr>
        <th>Model</th><th>Model ID</th><th>Removal Date</th><th>Status</th>
      </tr></thead><tbody>
        <tr><td colspan="4" style="text-align: center; opacity: 0.6; padding: 24px;">No models are currently scheduled for deprecation.</td></tr>
      </tbody></table>`;
    }

    const rows = deprecatingModels.map(model => {
      const depDate = model.model_spec?.deprecation?.date;
      const status = getDeprecationStatus(depDate);
      const isRetiring = status === 'retiring';
      const name = escapeHtml(model.model_spec?.name || model.id);
      return `<tr>
        <td>${name}</td>
        <td><code>${escapeHtml(model.id)}</code></td>
        <td>${formatDeprecationDate(depDate)}</td>
        <td><span class="${isRetiring ? 'vpt-status-retiring' : 'vpt-status-deprecated'}">${isRetiring ? 'Retiring Soon' : 'Deprecated'}</span></td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table vpt-deprecation-table"><thead><tr>
      <th>Model</th><th>Model ID</th><th>Removal Date</th><th>Status</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  // Cache pricing table for prompt caching guide
  function renderCachePricingTable(models) {
    const cacheModels = models
      .filter(m => m.type === 'text' && m.model_spec?.pricing?.cache_input)
      .filter(m => !isDeprecatedModel(m))
      .sort((a, b) => {
        const pA = a.model_spec?.pricing?.input?.usd || 999;
        const pB = b.model_spec?.pricing?.input?.usd || 999;
        return pB - pA; // Sort by input price descending (premium models first)
      });

    if (cacheModels.length === 0) return '<p>No models with cache pricing available.</p>';

    const rows = cacheModels.map(model => {
      const pricing = model.model_spec?.pricing || {};
      const modelId = escapeHtml(model.id);
      const input = pricing.input?.usd;
      const cacheRead = pricing.cache_input?.usd;
      const cacheWrite = pricing.cache_write?.usd;
      const output = pricing.output?.usd;
      const discount = input && cacheRead ? Math.round((1 - cacheRead / input) * 100) : null;

      return `<tr>
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td>
        <td class="vpt-price">${formatPrice(input)}</td>
        <td class="vpt-price">${formatPrice(cacheRead)}</td>
        <td class="vpt-price">${cacheWrite ? formatPrice(cacheWrite) : '—'}</td>
        <td class="vpt-price">${formatPrice(output)}</td>
        <td>${discount ? discount + '%' : '—'}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table"><thead><tr>
      <th>Model</th><th class="vpt-price">Input</th><th class="vpt-price">Cache Read</th><th class="vpt-price">Cache Write</th><th class="vpt-price">Output</th><th>Read Discount</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderCachePricingContent(models) {
    return `
      <p>Prices per 1M tokens. Models without cache pricing listed still benefit from caching at the provider level, they just aren't billed separately.</p>
      ${renderCachePricingTable(models)}
    `;
  }

  async function initCachePricing() {
    const el = document.getElementById('cache-pricing-placeholder');
    if (!el) return;

    // Always render static data immediately for instant display
    el.innerHTML = renderCachePricingContent(STATIC_MODELS);

    // Then try cache or fetch fresh data to update
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      el.innerHTML = renderCachePricingContent(cachedModels);
    }
    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderCachePricingContent(freshModels);
      }
    }).catch(() => {});
  }

  function ensurePlaceholderVisible(el) {
    el.style.visibility = 'visible';
    el.style.height = 'auto';
    el.style.overflow = 'visible';
  }

  async function initDeprecations() {
    const el = document.getElementById('deprecation-tracker-placeholder');
    if (!el) return;

    el.innerHTML = renderDeprecationTable(STATIC_MODELS);
    ensurePlaceholderVisible(el);

    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      el.innerHTML = renderDeprecationTable(cachedModels);
      ensurePlaceholderVisible(el);
    }
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        const el = document.getElementById('deprecation-tracker-placeholder');
        if (el) {
          el.innerHTML = renderDeprecationTable(freshModels);
          ensurePlaceholderVisible(el);
        }
      }
    }).catch(() => {});
  }

  // Traits list for deprecations page
  const TRAITS_CACHE_KEY = 'venice-traits-cache';
  const TRAITS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCachedTraits() {
    try {
      const cached = sessionStorage.getItem(TRAITS_CACHE_KEY);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > TRAITS_CACHE_TTL) {
        sessionStorage.removeItem(TRAITS_CACHE_KEY);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function setCachedTraits(traits) {
    try {
      sessionStorage.setItem(TRAITS_CACHE_KEY, JSON.stringify({
        data: traits,
        timestamp: Date.now()
      }));
    } catch {
      // Storage full or disabled
    }
  }

  async function fetchTraitsFromAPI() {
    try {
      const res = await fetch('https://api.venice.ai/api/v1/models/traits?type=text');
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      const traits = json.data || {};
      setCachedTraits(traits);
      return traits;
    } catch {
      return null;
    }
  }

  // Static fallback traits (updated when STATIC_MODELS changes)
  function getStaticTraits() {
    const traits = {};
    STATIC_MODELS.forEach(model => {
      if (model.type === 'text' && model.model_spec?.traits) {
        model.model_spec.traits.forEach(trait => {
          traits[trait] = model.id;
        });
      }
    });
    return traits;
  }

  function renderTraitsList(traits) {
    if (!traits || Object.keys(traits).length === 0) {
      return '<p style="opacity: 0.6;">No traits available.</p>';
    }

    // Define display order and labels for common traits
    const traitOrder = ['default', 'function_calling_default', 'default_vision', 'default_reasoning', 'default_code', 'most_uncensored', 'fastest', 'most_intelligent'];
    const traitLabels = {
      'default': 'default',
      'function_calling_default': 'function_calling_default',
      'default_vision': 'default_vision',
      'default_reasoning': 'default_reasoning',
      'default_code': 'default_code',
      'most_uncensored': 'most_uncensored',
      'fastest': 'fastest',
      'most_intelligent': 'most_intelligent'
    };

    // Sort traits: known traits first in order, then others alphabetically
    const sortedTraits = Object.keys(traits).sort((a, b) => {
      const aIndex = traitOrder.indexOf(a);
      const bIndex = traitOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    const items = sortedTraits.map(trait => {
      const modelId = traits[trait];
      const label = traitLabels[trait] || trait;
      return `<li><code>${escapeHtml(label)}</code> → currently routes to <code>${escapeHtml(modelId)}</code></li>`;
    }).join('\n');

    return `<ul>\n${items}\n</ul>`;
  }

  async function initTraitsList() {
    const el = document.getElementById('traits-list-placeholder');
    if (!el) return;

    el.innerHTML = renderTraitsList(getStaticTraits());
    ensurePlaceholderVisible(el);

    const cachedTraits = getCachedTraits();
    if (cachedTraits) {
      el.innerHTML = renderTraitsList(cachedTraits);
    }

    const freshTraits = await fetchTraitsFromAPI();
    if (freshTraits) {
      el.innerHTML = renderTraitsList(freshTraits);
    }
  }

  function renderBetaModelsTable(models) {
    const betaModels = models
      .filter(isBetaModel)
      .sort((a, b) => {
        const pA = a.model_spec?.pricing?.input?.usd || a.model_spec?.pricing?.generation?.usd || 999;
        const pB = b.model_spec?.pricing?.input?.usd || b.model_spec?.pricing?.generation?.usd || 999;
        return pA - pB;
      });

    const tableHead = '<table class="vpt-table"><thead><tr><th>Model</th><th>Model ID</th><th class="vpt-price">Price (In / Out)</th></tr></thead>';

    if (betaModels.length === 0) {
      return `${tableHead}<tbody>
        <tr><td colspan="3" style="text-align: center; opacity: 0.6; padding: 24px;">No beta models are currently available.</td></tr>
      </tbody></table>`;
    }

    const rows = betaModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const modelId = escapeHtml(model.id);
      const priceStr = pricing.input && pricing.output
        ? `${formatPrice(pricing.input.usd)} / ${formatPrice(pricing.output.usd)}`
        : formatPrice(pricing.generation?.usd);
      return `<tr>
        <td>${escapeHtml(spec.name || model.id)}</td>
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td>
        <td class="vpt-price">${priceStr}</td>
      </tr>`;
    }).join('');

    return `${tableHead}<tbody>${rows}</tbody></table>`;
  }

  async function initBetaModels() {
    const el = document.getElementById('beta-models-placeholder');
    if (!el) return;

    // Always render static data immediately for instant display
    el.innerHTML = renderBetaModelsTable(STATIC_MODELS);

    // Then try cache or fetch fresh data to update
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      el.innerHTML = renderBetaModelsTable(cachedModels);
    }
    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderBetaModelsTable(freshModels);
      }
    }).catch(() => {});
  }

  function renderReasoningModelsTable(models) {
    const reasoning = models
      .filter(m => m.type === 'text' && m.model_spec?.capabilities?.supportsReasoning && !m.model_spec?.deprecation)
      .sort((a, b) => (a.model_spec?.name || a.id).localeCompare(b.model_spec?.name || b.id));

    const tableHead = '<table class="vpt-table"><thead><tr><th>Model</th><th>Model ID</th></tr></thead>';

    if (reasoning.length === 0) {
      return `${tableHead}<tbody>
        <tr><td colspan="2" style="text-align: center; opacity: 0.6; padding: 24px;">Loading reasoning models...</td></tr>
      </tbody></table>`;
    }

    const rows = reasoning.map(model => {
      const modelId = escapeHtml(model.id);
      return `<tr>
        <td>${escapeHtml(model.model_spec?.name || model.id)}</td>
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td>
      </tr>`;
    }).join('');

    return `${tableHead}<tbody>${rows}</tbody></table>`;
  }

  async function initReasoningModels() {
    const el = document.getElementById('reasoning-models-placeholder');
    if (!el) return;

    el.innerHTML = renderReasoningModelsTable(STATIC_MODELS);

    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      el.innerHTML = renderReasoningModelsTable(cachedModels);
    }
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderReasoningModelsTable(freshModels);
      }
    }).catch(() => {});
  }

  function renderPricingTables(models) {
    const chatEl = document.getElementById('pricing-chat-placeholder');
    const embeddingEl = document.getElementById('pricing-embedding-placeholder');
    const imageEl = document.getElementById('pricing-image-placeholder');
    const audioEl = document.getElementById('pricing-audio-placeholder');
    const musicEl = document.getElementById('pricing-music-placeholder');
    const websearchEl = document.getElementById('pricing-websearch-placeholder');
    const videoEl = document.getElementById('pricing-video-placeholder');

    if (chatEl) {
      chatEl.innerHTML = `
        ${renderPricingChatTable(models)}
        <p class="vpt-beta-note">⚠️ <strong>Beta models</strong> are experimental and not recommended for production use. These models may be changed, removed, or replaced at any time without notice. <a href="/overview/beta-models">Learn more</a></p>
      `;
    }

    if (embeddingEl) {
      embeddingEl.innerHTML = renderPricingEmbeddingTable(models);
    }

    if (imageEl) {
      imageEl.innerHTML = `
        <h4>Generation</h4>
        ${renderPricingImageTable(models)}
        <h4>Upscaling</h4>
        ${renderPricingUpscaleTable(models)}
        <h4>Editing</h4>
        ${renderPricingEditTable(models)}
      `;
    }

    if (audioEl) {
      const asrHtml = renderPricingASRTable(models);
      audioEl.innerHTML = `
        <h4>Text-to-Speech</h4>
        ${renderPricingTTSTable(models)}
        ${asrHtml ? `<h4>Speech-to-Text</h4>${asrHtml}` : ''}
      `;
    }

    if (musicEl) {
      const durationHtml = renderPricingMusicDurationTable(models);
      const generationHtml = renderPricingMusicGenerationTable(models);
      const perSecondHtml = renderPricingMusicPerSecondTable(models);
      const musicSections = [];

      if (durationHtml) musicSections.push(`<h4>Song Generation (Duration-Based)</h4>${durationHtml}`);
      if (generationHtml) musicSections.push(`<h4>Song Generation (Per-Generation)</h4>${generationHtml}`);
      if (perSecondHtml) musicSections.push(`<h4>Sound Effects (Per-Second)</h4>${perSecondHtml}`);

      musicEl.innerHTML = musicSections.length > 0 ? musicSections.join('') : '<p>No music models available.</p>';
    }

    if (websearchEl) {
      websearchEl.innerHTML = renderPricingWebSearchTable();
    }

    if (videoEl) {
      videoEl.innerHTML = `
        <p class="vpt-video-note">Video pricing varies by resolution and duration. Visit the <a href="/models/video">Video Models page</a> for exact quotes, or use the <a href="/api-reference/endpoint/video/quote">Video Quote API</a>.</p>
        ${renderPricingVideoTable(models)}
      `;
      // Fetch video prices asynchronously
      updateVideoPricesForPricingPage(models);
    }

    [chatEl, embeddingEl, imageEl, audioEl, musicEl, websearchEl, videoEl].forEach(el => {
      if (el) {
        el.style.visibility = 'visible';
        el.style.height = 'auto';
        el.style.overflow = 'visible';
      }
    });
  }

  async function initPricing() {
    const chatEl = document.getElementById('pricing-chat-placeholder');
    const embeddingEl = document.getElementById('pricing-embedding-placeholder');
    const imageEl = document.getElementById('pricing-image-placeholder');
    const audioEl = document.getElementById('pricing-audio-placeholder');
    const musicEl = document.getElementById('pricing-music-placeholder');
    
    if (!chatEl && !embeddingEl && !imageEl && !audioEl && !musicEl) return;

    // Immediately render dynamic version from cache or STATIC_MODELS (instant, adds JS interactivity)
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      renderPricingTables(cachedModels);
    } else {
      renderPricingTables(STATIC_MODELS);
    }
    
    // Fetch fresh data in background and update when ready
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        renderPricingTables(freshModels);
      }
    }).catch(() => {});
  }

  // ========== MODEL BROWSER FUNCTIONS ==========

  async function init() {
    if (isInitializing) return;
    
    const placeholder = document.getElementById('model-search-placeholder');
    if (!placeholder) {
      setTimeout(init, 200);
      return;
    }
    
    isInitializing = true;
    const presetFilter = placeholder.dataset.filter || null;
    const hasCachedData = getCachedModels() !== null || STATIC_MODELS.length > 0;

    // Create container - show loading only if no data available
    const container = document.createElement('div');
    container.id = 'venice-model-browser';
    container.innerHTML = `
      <div class="vmb-toolbar">
        <div class="vmb-toolbar-left">
          <input type="text" class="vmb-search" placeholder="Search models..." aria-label="Search models" />
        </div>
        <div class="vmb-toolbar-right">
          <button class="vmb-sort-toggle" aria-label="Sort by date" title="Sort by date">
            <svg class="vmb-sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="vmb-filters" role="toolbar" aria-label="Model filters">
        <span class="vmb-category-filters" role="group" aria-label="Category filters">
          <button class="vmb-filter active" data-filter="all" aria-pressed="true">All</button>
          <button class="vmb-filter" data-filter="text" aria-pressed="false">Text</button>
          <button class="vmb-filter" data-filter="image" aria-pressed="false">Image</button>
          ${ENABLE_VIDEO ? '<button class="vmb-filter" data-filter="video" aria-pressed="false">Video</button>' : ''}
          <button class="vmb-filter" data-filter="audio" aria-pressed="false">Audio</button>
          <button class="vmb-filter" data-filter="embedding" aria-pressed="false">Embedding</button>
        </span>
        <span class="vmb-privacy-filters" role="group" aria-label="Privacy filters">
          <button class="vmb-filter" data-filter="e2ee" aria-pressed="false">E2EE</button>
          <button class="vmb-filter" data-filter="tee" aria-pressed="false">TEE</button>
          <button class="vmb-filter" data-filter="private" aria-pressed="false">Private</button>
          <button class="vmb-filter" data-filter="anonymized" aria-pressed="false">Anonymized</button>
        </span>
        <span class="vmb-capability-filters" role="group" aria-label="Capability filters">
          <button class="vmb-filter" data-filter="reasoning" aria-pressed="false">Reasoning</button>
          <button class="vmb-filter" data-filter="vision" aria-pressed="false">Vision</button>
          <button class="vmb-filter vmb-text-only" data-filter="function" aria-pressed="false">Function Calling</button>
          <button class="vmb-filter vmb-text-only" data-filter="code" aria-pressed="false">Code</button>
        </span>
        ${ENABLE_VIDEO ? `<span class="vmb-video-filters" role="group" aria-label="Video type filters">
          <button class="vmb-filter" data-filter="text-to-video" aria-pressed="false">Text to Video</button>
          <button class="vmb-filter" data-filter="image-to-video" aria-pressed="false">Image to Video</button>
        </span>` : ''}
        <span class="vmb-image-filters" role="group" aria-label="Image type filters">
          <button class="vmb-filter" data-filter="image-gen" aria-pressed="false">Generation</button>
          <button class="vmb-filter" data-filter="image-upscale" aria-pressed="false">Upscale</button>
          <button class="vmb-filter" data-filter="image-edit" aria-pressed="false">Edit</button>
          <button class="vmb-filter" data-filter="image-uncensored" aria-pressed="false">Uncensored</button>
        </span>
      </div>
      <div class="vmb-results-bar">
        <span class="vmb-count" aria-live="polite">${hasCachedData ? '' : 'Loading...'}</span>
      </div>
      <div class="vmb-models" role="list" aria-label="Model list">
        ${hasCachedData ? '' : '<div class="vmb-loading">Loading models...</div>'}
      </div>
    `;
    
    placeholder.replaceWith(container);

    // Get elements
    const searchInput = container.querySelector('.vmb-search');
    const filterButtons = container.querySelectorAll('.vmb-filter');
    const countDisplay = container.querySelector('.vmb-count');
    const modelsContainer = container.querySelector('.vmb-models');
    const categoryFilters = container.querySelector('.vmb-category-filters');
    const capabilityFilters = container.querySelector('.vmb-capability-filters');
    const videoFilters = ENABLE_VIDEO ? container.querySelector('.vmb-video-filters') : null;
    const imageFilters = container.querySelector('.vmb-image-filters');
    const privacyFilters = container.querySelector('.vmb-privacy-filters');
    
    // Configure filter visibility based on page context
    if (presetFilter) {
      categoryFilters.style.display = 'none';
      const filterVisibility = {
        text: { capability: true, video: false, image: false },
        video: { capability: false, video: true, image: false },
        image: { capability: false, video: false, image: true }
      };
      const config = filterVisibility[presetFilter] || { capability: false, video: false, image: false };
      capabilityFilters.style.display = config.capability ? 'contents' : 'none';
      if (videoFilters) videoFilters.style.display = config.video ? 'contents' : 'none';
      imageFilters.style.display = config.image ? 'contents' : 'none';
    } else {
      capabilityFilters.style.display = 'none';
      if (videoFilters) videoFilters.style.display = 'none';
      imageFilters.style.display = 'none';
    }

    let allModels = [];
    let activeFilter = presetFilter || 'all';
    let activeCapability = null;
    let activeVideoType = null;
    let activeImageType = null;
    let activePrivacy = null;
    // On overview page (no preset filter), default to newest first
    let activeSort = presetFilter ? 'default' : 'newest';
    
    const sortToggle = container.querySelector('.vmb-sort-toggle');
    
    // Set initial sort toggle UI state for overview page
    if (!presetFilter) {
      sortToggle.classList.add('active');
      sortToggle.title = 'Newest first (click for oldest)';
    }

    // Always render static data immediately for instant display
    allModels = STATIC_MODELS;
    renderModels();

    // Then try cache or fetch fresh data to update
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      allModels = cachedModels;
      renderModels();
    }
    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        allModels = freshModels;
        renderModels();
      }
    }).catch(() => {});

    function matchesCategory(model) {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'text') return model.type === 'text';
      if (activeFilter === 'image') return model.type === 'image' || model.type === 'upscale' || model.type === 'inpaint';
      if (activeFilter === 'video') return model.type === 'video';
      if (activeFilter === 'audio') return model.type === 'tts' || model.type === 'asr';
      if (activeFilter === 'embedding') return model.type === 'embedding';
      if (activeFilter === 'music') return model.type === 'music';
      return true;
    }

    function matchesCapability(model) {
      if (!activeCapability) return true;
      const spec = model.model_spec || {};
      const caps = spec.capabilities || {};
      
      if (activeCapability === 'reasoning') return caps.supportsReasoning;
      if (activeCapability === 'vision') return caps.supportsVision;
      if (activeCapability === 'function') return caps.supportsFunctionCalling;
      if (activeCapability === 'code') return matchesCodeFilter(model);
      return true;
    }

    function matchesVideoType(model) {
      if (!activeVideoType) return true;
      const constraints = model.model_spec?.constraints || {};
      return constraints.model_type === activeVideoType;
    }

    function matchesImageType(model) {
      if (!activeImageType) return true;
      const modelId = model.id.toLowerCase();
      
      if (activeImageType === 'image-gen') return model.type === 'image' && !modelId.includes('qwen');
      if (activeImageType === 'image-upscale') return model.type === 'upscale';
      if (activeImageType === 'image-edit') return model.type === 'inpaint' || modelId.includes('qwen-image');
      if (activeImageType === 'image-uncensored') return isUncensoredModel(model);
      return true;
    }

    function matchesPrivacy(model) {
      if (!activePrivacy) return true;
      if (activePrivacy === 'e2ee') return isE2EEModel(model);
      if (activePrivacy === 'tee') return isTEEModel(model);
      if (activePrivacy === 'private') return model.model_spec?.privacy === 'private' || PRIVATE_TYPES.has(model.type);
      if (activePrivacy === 'anonymized') return model.model_spec?.privacy === 'anonymized';
      return true;
    }

    function getModelPrice(model) {
      const pricing = model.model_spec?.pricing || {};
      return pricing.input?.usd || pricing.generation?.usd || pricing.per_audio_second?.usd || 0;
    }

    function sortModels(models) {
      if (activeSort === 'default') return models; // Keep API order
      
      const sorted = [...models];
      switch (activeSort) {
        case 'newest':
          return sorted.sort((a, b) => (b.created || 0) - (a.created || 0));
        case 'oldest':
          return sorted.sort((a, b) => (a.created || 0) - (b.created || 0));
        case 'price-low':
          return sorted.sort((a, b) => getModelPrice(a) - getModelPrice(b));
        case 'price-high':
          return sorted.sort((a, b) => getModelPrice(b) - getModelPrice(a));
        case 'name':
          return sorted.sort((a, b) => {
            const nameA = a.model_spec?.name || a.id || '';
            const nameB = b.model_spec?.name || b.id || '';
            return nameA.localeCompare(nameB);
          });
        default:
          return models;
      }
    }

    function renderModels() {
      const query = searchInput.value.toLowerCase().trim();
      
      const filtered = allModels.filter(model => {
        const spec = model.model_spec || {};
        const name = (spec.name || model.id || '').toLowerCase();
        const modelId = (model.id || '').toLowerCase();
        const caps = getCapabilities(spec.capabilities);
        
        const matchesSearch = !query || 
          name.includes(query) || 
          modelId.includes(query) ||
          caps.some(c => c.toLowerCase().includes(query));
        
        return matchesSearch && 
               matchesCategory(model) && 
               matchesCapability(model) && 
               matchesVideoType(model) && 
               matchesImageType(model) &&
               matchesPrivacy(model);
      });

      const sorted = sortModels(filtered);

      countDisplay.textContent = sorted.length + ' model' + (sorted.length !== 1 ? 's' : '');

      if (sorted.length === 0) {
        modelsContainer.innerHTML = '<div class="vmb-loading">No models match your filters</div>';
        return;
      }

      modelsContainer.innerHTML = sorted.map(model => renderModelCard(model)).join('');

      // Fetch video prices after render
      sorted.filter(m => m.type === 'video').forEach(model => {
        const constraints = model.model_spec?.constraints || {};
        const config = getVideoModelConfig(model.id);
        const defaultRes = constraints.resolutions?.[0];
        const defaultDur = constraints.durations?.[0];
        // Only send audio param for models that support audio pricing
        const defaultAudio = config.audioPricing ? true : undefined;
        updateVideoPrice(model.id, model, { resolution: defaultRes, duration: defaultDur, audio: defaultAudio }, modelsContainer);
      });
    }

    function renderModelCard(model) {
        const spec = model.model_spec || {};
      const caps = getCapabilities(spec.capabilities);
        const pricing = spec.pricing || model.pricing || {};
        const constraints = spec.constraints || {};
        
      // Context/info string
        let contextStr = '';
        if (spec.availableContextTokens) {
          contextStr = `${formatContext(spec.availableContextTokens)} context`;
      } else if (model.type === 'video') {
          // Video models - store config for info row
          const config = getVideoModelConfig(model.id);
          const resolutions = constraints.resolutions || [];
          const durations = constraints.durations || [];
          
          model._videoConfig = config;
          model._hasResDropdown = resolutions.length > 1 && config.resPricing !== false;
          model._hasDurDropdown = durations.length > 1;
          model._hasAudioToggle = !!config.audioPricing;
          model._resolutions = resolutions;
          model._durations = durations;
      } else if (model.type === 'tts' && spec.voices?.length > 0) {
          contextStr = `${spec.voices.length} voices`;
        }
        
      // Pricing display
        let priceStr = '';
        let videoControlsHtml = '';
        if (model.type === 'video') {
          // Build video controls for info row
          const resolutions = model._resolutions || [];
          const durations = model._durations || [];
          
          if (model._hasResDropdown) {
            const resOptions = resolutions.map((r, i) => 
              `<option value="${r}"${i === 0 ? ' selected' : ''}>${r}</option>`
            ).join('');
            videoControlsHtml += `<select class="vmb-res-select vmb-video-select" data-model="${model.id}">${resOptions}</select>`;
          }
          if (model._hasDurDropdown) {
            const durOptions = durations.map((d, i) => 
              `<option value="${d}"${i === 0 ? ' selected' : ''}>${d}</option>`
            ).join('');
            videoControlsHtml += `<select class="vmb-dur-select vmb-video-select" data-model="${model.id}">${durOptions}</select>`;
          }
          if (model._hasAudioToggle) {
            videoControlsHtml += `<span class="vmb-audio-toggle" data-model="${model.id}" data-audio="true">♪ Audio</span>`;
          }
          videoControlsHtml += `<span class="vmb-video-price" data-model="${model.id}">Variable</span>`;
        } else if (model.type === 'image' && pricing.resolutions) {
          // Image models with resolution-based pricing
          const resolutions = constraints.resolutions || Object.keys(pricing.resolutions);
          const defaultRes = constraints.defaultResolution || resolutions[0];
          const defaultPrice = pricing.resolutions[defaultRes]?.usd;
          if (resolutions.length > 1) {
            const resOptions = resolutions.map(r => 
              `<option value="${r}"${r === defaultRes ? ' selected' : ''}>${r}</option>`
            ).join('');
            contextStr = `<select class="vmb-res-select vmb-img-res" data-model="${model.id}">${resOptions}</select>`;
          }
          priceStr = `<span class="vmb-img-price-val" data-model="${model.id}">${formatPrice(defaultPrice)}</span>/image`;
        } else if (model.type === 'image' && pricing.generation) {
          priceStr = `${formatPrice(pricing.generation.usd)}/image`;
        } else if (model.type === 'inpaint' && pricing.inpaint) {
          priceStr = `${formatPrice(pricing.inpaint.usd)}/edit`;
        } else if (pricing.input && pricing.output) {
          priceStr = `${formatPrice(pricing.input.usd)}/M input <span class="vmb-pipe">|</span> ${formatPrice(pricing.output.usd)}/M output`;
          if (pricing.cache_input?.usd && pricing.cache_write?.usd) {
            priceStr += ` <span class="vmb-pipe">|</span> ${formatPrice(pricing.cache_input.usd)}/${formatPrice(pricing.cache_write.usd)} cache`;
          } else if (pricing.cache_input?.usd) {
            priceStr += ` <span class="vmb-pipe">|</span> ${formatPrice(pricing.cache_input.usd)} cache`;
          }
          if (pricing.extended) {
            const ext = pricing.extended;
            const threshold = ext.context_token_threshold >= 1000 ? `${Math.round(ext.context_token_threshold / 1000)}K` : ext.context_token_threshold;
            priceStr += `<br><span class="vmb-extended-pricing vmb-tooltip" data-tooltip="This model uses higher rates when your prompt exceeds ${threshold} tokens.">&gt;${threshold} context: ${formatPrice(ext.input?.usd)}/${formatPrice(ext.output?.usd)}`;
            if (ext.cache_input?.usd && ext.cache_write?.usd) {
              priceStr += ` <span class="vmb-pipe">|</span> ${formatPrice(ext.cache_input.usd)}/${formatPrice(ext.cache_write.usd)} cache`;
            } else if (ext.cache_input?.usd) {
              priceStr += ` <span class="vmb-pipe">|</span> ${formatPrice(ext.cache_input.usd)} cache`;
            }
            priceStr += `</span>`;
          }
        } else if (pricing.input && model.type === 'tts') {
          priceStr = `${formatPrice(pricing.input.usd)}/M chars`;
        } else if (model.type === 'upscale' && (pricing.upscale || pricing['2x'] || pricing['4x'])) {
          const upscalePricing = pricing.upscale || pricing;
          const prices = [];
          if (upscalePricing['2x']?.usd) prices.push(`${formatPrice(upscalePricing['2x'].usd)} 2x`);
          if (upscalePricing['4x']?.usd) prices.push(`${formatPrice(upscalePricing['4x'].usd)} 4x`);
          priceStr = prices.join(' · ');
        } else if (model.type === 'music' && pricing.durations) {
          const durationKeys = Object.keys(pricing.durations).sort((a, b) => Number(a) - Number(b));
          if (durationKeys.length > 0) {
            const minDur = durationKeys[0];
            const minPrice = pricing.durations[minDur]?.usd;
            priceStr = `from ${formatPrice(minPrice)}/${minDur}s`;
          }
        } else if (model.type === 'music' && pricing.per_second) {
          priceStr = `${formatPrice(pricing.per_second.usd)}/sec`;
        } else if (model.type === 'music' && pricing.generation) {
          priceStr = `${formatPrice(pricing.generation.usd)}/audio`;
        } else if (pricing.generation) {
          priceStr = `${formatPrice(pricing.generation.usd)}/image`;
        } else if (pricing.perCharacter) {
          priceStr = `${formatPrice(pricing.perCharacter.usd * 1000000)}/M chars`;
        } else if (pricing.per_audio_second) {
          priceStr = `${formatPrice(pricing.per_audio_second.usd)}/sec`;
        }
        
        const modelName = escapeHtml(spec.name || model.id);
        const modelId = escapeHtml(model.id);
      
      // Release date for NEW badge
      const dateInfo = formatAddedDate(model.created);
      
      const hasLink = spec.modelSource?.length > 0;
        const nameLink = hasLink
          ? `<a href="${escapeHtml(spec.modelSource)}" target="_blank" rel="noopener" class="vmb-model-name">${modelName}</a>`
          : `<span class="vmb-model-name">${modelName}</span>`;

      // Badges (skip type badge for video - we use video type badge instead)
      const typeBadge = model.type !== 'text' && model.type !== 'video'
        ? `<span class="vmb-type-badge">${escapeHtml(model.type)}</span>` 
        : '';
      
      const videoTypeBadge = model.type === 'video' && constraints.model_type
        ? `<span class="vmb-video-type-badge ${constraints.model_type === 'text-to-video' ? 'ttv' : 'itv'}">${constraints.model_type === 'text-to-video' ? 'TEXT TO VIDEO' : 'IMAGE TO VIDEO'}</span>`
        : '';
      
      const privacyBadge = getPrivacyTag(model, 'vmb');
      
      const betaBadge = isBetaModel(model)
        ? `<span class="vmb-beta-badge vmb-tooltip" data-tooltip="${TOOLTIPS.beta}">Beta</span>` 
        : '';
      
      const deprecatedBadge = isDeprecatedModel(model)
        ? `<span class="vmb-deprecated-badge vmb-tooltip" data-tooltip="Scheduled for removal on ${formatDeprecationDate(model.model_spec?.deprecation?.date)}. See the deprecations page for details.">Deprecated</span>` 
        : '';
      
      const uncensoredBadge = isUncensoredModel(model)
        ? `<span class="vmb-uncensored-badge vmb-tooltip" data-tooltip="${TOOLTIPS.uncensored}">Uncensored</span>` 
        : '';
      
      const upgradedBadge = isUpgradedModel(model)
        ? `<span class="vmb-upgraded-badge vmb-tooltip" data-tooltip="${TOOLTIPS.upgraded}">Upgraded</span>` 
        : '';
      
      const moderationBadge = hasContentModeration(model.id)
        ? `<span class="vmb-moderation-badge vmb-tooltip" data-tooltip="${TOOLTIPS.content_moderation}">Moderated</span>`
        : '';
      
      const newBadge = dateInfo?.isNew
        ? '<span class="vmb-new-badge">NEW</span>'
        : '';
      
      // Rate limit tier badge (text/embedding only)
      const rateTier = getModelRateLimitTier(model.id, model.type);
      const rateLimitBadge = rateTier
        ? `<span class="vmb-ratelimit-badge vmb-tooltip tier-${rateTier}" data-tooltip="${RATE_LIMIT_TIERS[rateTier].tooltip}">${RATE_LIMIT_TIERS[rateTier].label}</span>`
        : '';

      // Copy button SVGs
        const copyIcon = `<svg class="copy-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        const checkIcon = `<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
      const copyBtn = `<button class="vmb-copy-btn" data-model-id="${modelId}" title="Copy model ID" aria-label="Copy model ID ${modelId}">${copyIcon}${checkIcon}</button>`;

      // Video-specific metadata (show items not already in controls, always show audio capability)
      const aspectRatios = getAspectRatios(constraints);
      const aspectRatioHtml = aspectRatios.length > 0 
        ? `<span class="vmb-aspect-ratios">${aspectRatios.map(ar => {
            const [w, h] = ar.split(':').map(Number);
            const isLandscape = w > h;
            const isPortrait = h > w;
            const cls = isLandscape ? 'landscape' : isPortrait ? 'portrait' : 'square';
            return `<span class="vmb-ar ${cls}" title="${ar}"></span>`;
          }).join('')}</span>` 
        : '';
      const videoMeta = model.type === 'video' ? [
        aspectRatioHtml,
        !model._hasResDropdown && constraints.resolutions?.length ? constraints.resolutions.join(', ') : '',
        !model._hasDurDropdown && constraints.durations?.length ? constraints.durations.join(', ') : '',
        constraints.audio ? 'Audio' : ''
      ].filter(Boolean).join(' · ') : '';

      // Capability icons
      const capIcons = getCapabilityIcons(spec.capabilities);
      
      // Copy button for model ID
      const idCopyBtn = `<button class="vmb-id-copy-btn" data-model-id="${modelId}" title="Copy model ID" aria-label="Copy model ID">
        <svg class="copy-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </button>`;
      
      // Left side: model-id and pricing (or video controls)
      const leftParts = [
        `<span class="vmb-model-id"><span class="vmb-id-text">${modelId}</span>${idCopyBtn}</span>`,
        model.type === 'video' && videoControlsHtml 
          ? `<span class="vmb-video-controls">${videoControlsHtml}</span>` 
          : (priceStr ? `<span class="vmb-pricing">${priceStr}</span>` : ''),
        videoMeta && model.type !== 'video' ? `<span class="vmb-video-info">${videoMeta}</span>` : ''
      ].filter(Boolean);

      // Right side: capabilities and date
      const releaseDateHtml = dateInfo ? `<span class="vmb-release-date">Added ${dateInfo.dateStr}</span>` : '';

        // Context for mobile bottom row
      const contextMobile = contextStr ? `<span class="vmb-context vmb-context-mobile">${contextStr}</span>` : '';
      
      return `
        <div class="vmb-model" role="listitem">
            <div class="vmb-model-row">
              <div class="vmb-model-left">
                ${nameLink}${copyBtn}${dateInfo?.isNew ? '<span class="vmb-new-dot" title="Recently added">New</span>' : ''}
              </div>
              <div class="vmb-model-right">
                ${contextStr ? `<span class="vmb-context vmb-context-desktop">${contextStr}</span>` : ''}
                ${typeBadge}${videoTypeBadge}${privacyBadge}${betaBadge}${deprecatedBadge}${upgradedBadge}${uncensoredBadge}${moderationBadge}${rateLimitBadge}
              </div>
            </div>
            <div class="vmb-model-info">
              <span class="vmb-info-left">${leftParts.join('<span class="vmb-dot">·</span>')}</span>
              <span class="vmb-info-right">${capIcons}${contextMobile}${releaseDateHtml}</span>
            </div>
          </div>
        `;
    }

    function updateAriaPressed(btn, isActive) {
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    // Event: Search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(renderModels, 100);
    });

    // Event: Sort toggle - cycles through: default → newest → oldest → default
    sortToggle.addEventListener('click', () => {
      const cycle = ['default', 'newest', 'oldest'];
      const currentIndex = cycle.indexOf(activeSort);
      const nextIndex = (currentIndex + 1) % cycle.length;
      activeSort = cycle[nextIndex];
      
      // Update icon direction and active state
      sortToggle.classList.toggle('active', activeSort !== 'default');
      sortToggle.classList.toggle('asc', activeSort === 'oldest');
      sortToggle.title = activeSort === 'default' ? 'Sort by date' : 
                         activeSort === 'newest' ? 'Newest first (click for oldest)' : 
                         'Oldest first (click to reset)';
      renderModels();
    });

    // Event: Filter buttons
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        const isCapability = CAPABILITY_FILTERS.includes(filter);
        const isVideoType = VIDEO_FILTERS.includes(filter);
        const isImageType = IMAGE_FILTERS.includes(filter);
        const isPrivacy = PRIVACY_FILTERS.includes(filter);
        
        if (isPrivacy) {
          if (activePrivacy === filter) {
            activePrivacy = null;
            btn.classList.remove('active');
            updateAriaPressed(btn, false);
          } else {
            privacyFilters.querySelectorAll('.vmb-filter').forEach(b => {
              b.classList.remove('active');
              updateAriaPressed(b, false);
            });
            activePrivacy = filter;
            btn.classList.add('active');
            updateAriaPressed(btn, true);
          }
        } else if (isCapability) {
          if (activeCapability === filter) {
            activeCapability = null;
            btn.classList.remove('active');
            updateAriaPressed(btn, false);
          } else {
            capabilityFilters.querySelectorAll('.vmb-filter').forEach(b => {
              b.classList.remove('active');
              updateAriaPressed(b, false);
            });
            activeCapability = filter;
            btn.classList.add('active');
            updateAriaPressed(btn, true);
          }
        } else if (isVideoType && videoFilters) {
          if (activeVideoType === filter) {
            activeVideoType = null;
            btn.classList.remove('active');
            updateAriaPressed(btn, false);
          } else {
            videoFilters.querySelectorAll('.vmb-filter').forEach(b => {
              b.classList.remove('active');
              updateAriaPressed(b, false);
            });
            activeVideoType = filter;
            btn.classList.add('active');
            updateAriaPressed(btn, true);
          }
        } else if (isImageType) {
          if (activeImageType === filter) {
            activeImageType = null;
            btn.classList.remove('active');
            updateAriaPressed(btn, false);
          } else {
            imageFilters.querySelectorAll('.vmb-filter').forEach(b => {
              b.classList.remove('active');
              updateAriaPressed(b, false);
            });
            activeImageType = filter;
            btn.classList.add('active');
            updateAriaPressed(btn, true);
          }
        } else {
          // Category filter (main page only) - preserve privacy filter state
          activeFilter = filter;
          activeCapability = null;
          activeVideoType = null;
          activeImageType = null;
          filterButtons.forEach(b => {
            if (!PRIVACY_FILTERS.includes(b.dataset.filter)) {
              b.classList.remove('active');
              updateAriaPressed(b, false);
            }
          });
          btn.classList.add('active');
          updateAriaPressed(btn, true);
        }
        renderModels();
      });
    });

    // Event: Copy button (delegated) - handles both name and ID copy buttons
    modelsContainer.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('.vmb-copy-btn, .vmb-id-copy-btn');
      if (!copyBtn) return;
      
      const modelId = copyBtn.dataset.modelId;
      await navigator.clipboard.writeText(modelId).catch(() => {});
      copyBtn.classList.add('copied');
      
      // Show copied tooltip
      const existingTooltip = copyBtn.querySelector('.vmb-copied-tooltip');
      if (existingTooltip) existingTooltip.remove();
      
      const tooltip = document.createElement('span');
      tooltip.className = 'vmb-copied-tooltip';
      tooltip.textContent = 'Copied';
      copyBtn.appendChild(tooltip);
      
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        tooltip.remove();
      }, 1500);
    });

    // Event: Resolution/duration pricing controls
    modelsContainer.addEventListener('change', (e) => {
      const target = e.target;
      const isResSelect = target.classList.contains('vmb-res-select');
      const isDurSelect = target.classList.contains('vmb-dur-select');
      const isImgRes = target.classList.contains('vmb-img-res');
      
      if (!isResSelect && !isDurSelect) return;
      
      const modelId = target.dataset.model;
      const model = allModels.find(m => m.id === modelId);
      if (!model) return;
      
      // Handle image resolution pricing
      if (isImgRes) {
        const resolution = target.value;
        const price = model.model_spec?.pricing?.resolutions?.[resolution]?.usd;
        const priceEl = target.closest('.vmb-model')?.querySelector('.vmb-img-price-val');
        if (priceEl && price !== undefined) {
          priceEl.textContent = formatPrice(price);
        }
        return;
      }
      
      // Handle video pricing
      const card = target.closest('.vmb-model');
      const resSelect = card.querySelector('.vmb-res-select');
      const durSelect = card.querySelector('.vmb-dur-select');
      const audioToggle = card.querySelector('.vmb-audio-toggle');
      
      const resolution = resSelect?.value;
      const duration = durSelect?.value;
      const audio = audioToggle ? audioToggle.dataset.audio === 'true' : undefined;
      
      updateVideoPrice(modelId, model, { resolution, duration, audio }, modelsContainer);
    });

    // Event: Audio toggle click
    modelsContainer.addEventListener('click', (e) => {
      const toggle = e.target.closest('.vmb-audio-toggle');
      if (!toggle) return;
      
      const isOn = toggle.dataset.audio === 'true';
      toggle.dataset.audio = isOn ? 'false' : 'true';
      toggle.textContent = isOn ? '♪ No Audio' : '♪ Audio';
      toggle.classList.toggle('off', isOn);
      
      const modelId = toggle.dataset.model;
      const model = allModels.find(m => m.id === modelId);
      if (!model) return;
      
      const card = toggle.closest('.vmb-model');
      const resSelect = card.querySelector('.vmb-res-select');
      const durSelect = card.querySelector('.vmb-dur-select');
      
      updateVideoPrice(modelId, model, { 
        resolution: resSelect?.value, 
        duration: durSelect?.value, 
        audio: !isOn 
      }, modelsContainer);
    });
  }

  // ========== INITIALIZATION ==========

  let lastUrl = window.location.href;
  let modelsInitialized = false;

  // Page initializer state tracking
  const pageInitializers = {
    pricing: { initialized: false, rendered: false, promise: null },
    deprecations: { initialized: false, rendered: false, promise: null },
    traitsList: { initialized: false, rendered: false, promise: null },
    betaModels: { initialized: false, rendered: false, promise: null },
    cachePricing: { initialized: false, rendered: false, promise: null },
    reasoningModels: { initialized: false, rendered: false, promise: null }
  };

  // Global copy button handler
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.vpt-copy-btn');
    if (!btn) return;
    await navigator.clipboard.writeText(btn.dataset.modelId).catch(() => {});
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  });

  // Pricing table resolution dropdown handler
  document.addEventListener('change', async (e) => {
    const select = e.target.closest('.vpt-res-select');
    if (!select) return;
    const modelId = select.dataset.model;
    const resolution = select.value;
    const models = getCachedModels() || await fetchModelsFromAPI();
    const model = models.find(m => m.id === modelId);
    if (!model) return;
    const price = model.model_spec?.pricing?.resolutions?.[resolution]?.usd;
    const priceEl = document.querySelector(`.vpt-res-price[data-model="${modelId}"]`);
    if (priceEl && price !== undefined) {
      priceEl.textContent = formatPrice(price);
    }
  });

  function tryInitModels() {
    if (modelsInitialized) return;
    if (!window.location.pathname.includes('/models')) return;
    const placeholder = document.getElementById('model-search-placeholder');
    if (placeholder && !document.getElementById('venice-model-browser')) {
      modelsInitialized = true;
      isInitializing = false;
      init();
    }
  }

  function createPageInitializer(config) {
    const { pathMatch, elementId, initFn, resetCheck } = config;
    const state = pageInitializers[config.name];

    return function tryInit() {
      if (!window.location.pathname.toLowerCase().includes(pathMatch)) return;
      
      const el = document.getElementById(elementId);
      if (!el) return;
      
      if (state.rendered && resetCheck(el)) {
        state.initialized = false;
        state.rendered = false;
      }
      
      if (state.initialized || state.promise) return;
      
      state.initialized = true;
      state.promise = initFn().then(() => {
        state.rendered = true;
      }).finally(() => {
        state.promise = null;
      });
    };
  }

  const tryInitPricing = createPageInitializer({
    name: 'pricing',
    pathMatch: 'pricing',
    elementId: 'pricing-chat-placeholder',
    initFn: initPricing,
    resetCheck: el => el.textContent.includes('Loading')
  });

  const tryInitDeprecations = createPageInitializer({
    name: 'deprecations',
    pathMatch: 'deprecation',
    elementId: 'deprecation-tracker-placeholder',
    initFn: initDeprecations,
    resetCheck: el => el.innerHTML === ''
  });

  const tryInitTraitsList = createPageInitializer({
    name: 'traitsList',
    pathMatch: 'deprecation',
    elementId: 'traits-list-placeholder',
    initFn: initTraitsList,
    resetCheck: el => el.innerHTML === ''
  });

  const tryInitBetaModels = createPageInitializer({
    name: 'betaModels',
    pathMatch: 'beta-models',
    elementId: 'beta-models-placeholder',
    initFn: initBetaModels,
    resetCheck: el => el.innerHTML === ''
  });

  const tryInitCachePricing = createPageInitializer({
    name: 'cachePricing',
    pathMatch: 'prompt-caching',
    elementId: 'cache-pricing-placeholder',
    initFn: initCachePricing,
    resetCheck: el => el.textContent.includes('Loading')
  });

  const tryInitReasoningModels = createPageInitializer({
    name: 'reasoningModels',
    pathMatch: 'reasoning-models',
    elementId: 'reasoning-models-placeholder',
    initFn: initReasoningModels,
    resetCheck: el => el.innerHTML === ''
  });

  function resetAllInitializers() {
    modelsInitialized = false;
    Object.values(pageInitializers).forEach(state => {
      state.initialized = false;
    });
  }

  function tryInitAll() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      resetAllInitializers();
    }
    tryInitModels();
    tryInitPricing();
    tryInitDeprecations();
    tryInitTraitsList();
    tryInitBetaModels();
    tryInitCachePricing();
    tryInitReasoningModels();
  }

  function setupObserver() {
    if (!document.body) {
      setTimeout(setupObserver, 50);
      return;
    }
    let timeout = null;
    const observer = new MutationObserver(() => {
      if (timeout) return;
      timeout = setTimeout(() => {
        timeout = null;
        tryInitAll();
      }, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function retryInit(pathMatch, checkFn, tryFn, maxRetries = 20) {
    if (!window.location.pathname.toLowerCase().includes(pathMatch)) return;
    if (checkFn()) return;
    
    let retries = 0;
    const interval = setInterval(() => {
      if (checkFn() || retries++ > maxRetries) {
        clearInterval(interval);
        return;
      }
      tryFn();
    }, 100);
  }

  function start() {
    tryInitAll();
    setupObserver();
    
    // Retry for pages where elements may load late
    retryInit('pricing', () => pageInitializers.pricing.initialized, tryInitPricing);
    retryInit('deprecation', () => pageInitializers.deprecations.initialized, tryInitDeprecations);
    retryInit('deprecation', () => pageInitializers.traitsList.initialized, tryInitTraitsList);
    retryInit('beta-models', () => pageInitializers.betaModels.initialized, tryInitBetaModels);
    retryInit('prompt-caching', () => pageInitializers.cachePricing.initialized, tryInitCachePricing);
    retryInit('reasoning-models', () => pageInitializers.reasoningModels.initialized, tryInitReasoningModels);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
