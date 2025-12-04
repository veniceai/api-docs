'use client';

import React, { useState, useMemo } from 'react';

const models = [
  // Text Models
  { id: 'qwen3-4b', name: 'Venice Small', description: 'Fast and efficient model for everyday tasks with reasoning capabilities', context: '32K', inputPrice: '$0.05', outputPrice: '$0.15', category: 'text', capabilities: ['Function Calling', 'Reasoning'], source: 'https://huggingface.co/Qwen/Qwen3-4B' },
  { id: 'mistral-31-24b', name: 'Venice Medium', description: 'Balanced performance with vision capabilities for multimodal tasks', context: '131K', inputPrice: '$0.50', outputPrice: '$2.00', category: 'text', capabilities: ['Function Calling', 'Vision'], source: 'https://huggingface.co/mistralai/Mistral-Small-3.1-24B-Instruct-2503' },
  { id: 'qwen3-235b', name: 'Venice Large 1.1', description: 'High-performance reasoning model for complex tasks', context: '131K', inputPrice: '$0.45', outputPrice: '$3.50', category: 'text', capabilities: ['Function Calling', 'Reasoning'], source: 'https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507-FP8' },
  { id: 'qwen3-235b-a22b-thinking-2507', name: 'Qwen 3 235B Thinking', description: 'Advanced reasoning model with extended thinking capabilities', context: '131K', inputPrice: '$0.45', outputPrice: '$3.50', category: 'text', capabilities: ['Function Calling', 'Reasoning'], source: 'https://huggingface.co/Qwen/Qwen3-235B-A22B-Thinking-2507-FP8' },
  { id: 'qwen3-235b-a22b-instruct-2507', name: 'Qwen 3 235B Instruct', description: 'Instruction-tuned variant optimized for direct responses', context: '131K', inputPrice: '$0.15', outputPrice: '$0.75', category: 'text', capabilities: ['Function Calling'], source: 'https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507-FP8' },
  { id: 'qwen3-coder-480b-a35b-instruct', name: 'Qwen 3 Coder 480B', description: 'Specialized for code generation with massive 480B parameters', context: '262K', inputPrice: '$0.75', outputPrice: '$3.00', category: 'text', capabilities: ['Function Calling'], source: 'https://huggingface.co/Qwen/Qwen3-Coder-480B-A35B-Instruct' },
  { id: 'venice-uncensored', name: 'Venice Uncensored 1.1', description: 'Uncensored model for unrestricted conversations', context: '32K', inputPrice: '$0.20', outputPrice: '$0.90', category: 'text', capabilities: [], source: 'https://huggingface.co/cognitivecomputations/Dolphin-Mistral-24B-Venice-Edition' },
  { id: 'zai-org-glm-4.6', name: 'GLM 4.6', description: 'General-purpose language model with function calling support', context: '202K', inputPrice: '$0.85', outputPrice: '$2.75', category: 'text', capabilities: ['Function Calling'], source: 'https://huggingface.co/zai-org/GLM-4.6' },
  { id: 'llama-3.2-3b', name: 'Llama 3.2 3B', description: 'Lightweight and fast model for simple tasks', context: '131K', inputPrice: '$0.15', outputPrice: '$0.60', category: 'text', capabilities: ['Function Calling'], source: 'https://huggingface.co/meta-llama/Llama-3.2-3B' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Default model for general-purpose chat and function calling', context: '131K', inputPrice: '$0.70', outputPrice: '$2.80', category: 'text', capabilities: ['Function Calling'], source: 'https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct' },
  // Beta Text Models
  { id: 'grok-41-fast', name: 'Grok 4.1 Fast', description: 'Fast multimodal model with reasoning and vision capabilities', context: '262K', inputPrice: '$0.50', outputPrice: '$1.25', category: 'text', capabilities: ['Function Calling', 'Reasoning', 'Vision'], isAnonymized: true, isBeta: true },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', description: "Google's frontier model with advanced reasoning and vision", context: '202K', inputPrice: '$2.50', outputPrice: '$15.00', category: 'text', capabilities: ['Function Calling', 'Reasoning', 'Vision'], isAnonymized: true, isBeta: true, source: 'https://deepmind.google/models/gemini/pro/' },
  { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking', description: 'Advanced reasoning model optimized for code and complex tasks', context: '262K', inputPrice: '$0.75', outputPrice: '$3.20', category: 'text', capabilities: ['Function Calling', 'Reasoning'], isAnonymized: true, isBeta: true, source: 'https://huggingface.co/moonshotai/Kimi-K2-Thinking' },
  { id: 'openai-gpt-oss-120b', name: 'OpenAI GPT OSS 120B', description: "OpenAI's open-source 120B parameter model", context: '131K', inputPrice: '$0.07', outputPrice: '$0.30', category: 'text', capabilities: ['Function Calling'], isBeta: true, source: 'https://huggingface.co/openai/gpt-oss-120b' },
  { id: 'google-gemma-3-27b-it', name: 'Google Gemma 3 27B', description: "Google's efficient open model with vision support", context: '202K', inputPrice: '$0.12', outputPrice: '$0.20', category: 'text', capabilities: ['Function Calling', 'Vision'], isBeta: true, source: 'https://huggingface.co/google/gemma-3-27b-it' },
  { id: 'qwen3-next-80b', name: 'Qwen 3 Next 80B', description: 'Next-generation Qwen model with extended context', context: '262K', inputPrice: '$0.35', outputPrice: '$1.90', category: 'text', capabilities: ['Function Calling'], isBeta: true, source: 'https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct' },
  { id: 'deepseek-ai-DeepSeek-R1', name: 'DeepSeek R1', description: "DeepSeek's reasoning model", context: '131K', inputPrice: '$0.85', outputPrice: '$2.75', category: 'text', capabilities: ['Function Calling'], isBeta: true, source: 'https://huggingface.co/deepseek-ai/DeepSeek-R1' },
  { id: 'hermes-3-llama-3.1-405b', name: 'Hermes 3 Llama 3.1 405B', description: "Nous Research's largest Hermes model based on Llama 3.1", context: '131K', inputPrice: '$1.10', outputPrice: '$3.00', category: 'text', capabilities: [], isBeta: true, source: 'https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-405B' },
  // Image Models
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', description: 'High-quality image generation with advanced capabilities', context: '—', inputPrice: '$0.18', outputPrice: 'per image', category: 'image', capabilities: [], isAnonymized: true, source: 'https://deepmind.google/models/gemini-image/pro/' },
  { id: 'venice-sd35', name: 'Venice SD35', description: 'Default image generation model based on Stable Diffusion 3.5', context: '—', inputPrice: '$0.01', outputPrice: 'per image', category: 'image', capabilities: [], source: 'https://huggingface.co/stabilityai/stable-diffusion-3.5-large' },
  { id: 'hidream', name: 'HiDream', description: 'Dreamlike image generation with artistic flair', context: '—', inputPrice: '$0.01', outputPrice: 'per image', category: 'image', capabilities: [], source: 'https://huggingface.co/HiDream-ai/HiDream-I1-Dev' },
  { id: 'qwen-image', name: 'Qwen Image', description: 'Multimodal image generation and editing', context: '—', inputPrice: '$0.01', outputPrice: 'per image', category: 'image', capabilities: [], source: 'https://huggingface.co/Qwen/Qwen-Image' },
  { id: 'lustify-sdxl', name: 'Lustify SDXL', description: 'SDXL-based model for expressive imagery', context: '—', inputPrice: '$0.01', outputPrice: 'per image', category: 'image', capabilities: [] },
  { id: 'lustify-v7', name: 'Lustify v7', description: 'Latest Lustify model with enhanced quality', context: '—', inputPrice: '$0.01', outputPrice: 'per image', category: 'image', capabilities: [] },
  { id: 'wai-Illustrious', name: 'Anime (WAI)', description: 'Specialized for anime and illustration styles', context: '—', inputPrice: '$0.01', outputPrice: 'per image', category: 'image', capabilities: [] },
  // Audio Models
  { id: 'tts-kokoro', name: 'Kokoro TTS', description: 'High-quality text-to-speech with 60+ multilingual voices', context: '—', inputPrice: '$3.50', outputPrice: 'per 1M chars', category: 'audio', capabilities: [], source: 'https://huggingface.co/hexgrad/Kokoro-82M' },
  // Embedding Models
  { id: 'text-embedding-bge-m3', name: 'BGE-M3', description: 'Versatile multilingual embedding model for semantic search', context: '—', inputPrice: '$0.15', outputPrice: '$0.60', category: 'embedding', capabilities: [], source: 'https://huggingface.co/KimChen/bge-m3-GGUF' },
];

const categories = [
  { id: 'all', label: 'All', count: models.length },
  { id: 'text', label: 'Text', count: models.filter(m => m.category === 'text').length },
  { id: 'image', label: 'Image', count: models.filter(m => m.category === 'image').length },
  { id: 'audio', label: 'Audio', count: models.filter(m => m.category === 'audio').length },
  { id: 'embedding', label: 'Embeddings', count: models.filter(m => m.category === 'embedding').length },
];

const capabilityFilters = ['Function Calling', 'Reasoning', 'Vision'];

export default function ModelSearch() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedCapabilities, setSelectedCapabilities] = useState([]);
  const [showBetaOnly, setShowBetaOnly] = useState(false);

  const filteredModels = useMemo(() => {
    return models.filter(model => {
      const matchesSearch = model.name.toLowerCase().includes(search.toLowerCase()) ||
        model.id.toLowerCase().includes(search.toLowerCase()) ||
        model.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'all' || model.category === category;
      const matchesCapabilities = selectedCapabilities.length === 0 ||
        selectedCapabilities.every(cap => model.capabilities.includes(cap));
      const matchesBeta = !showBetaOnly || model.isBeta;
      return matchesSearch && matchesCategory && matchesCapabilities && matchesBeta;
    });
  }, [search, category, selectedCapabilities, showBetaOnly]);

  const toggleCapability = (cap) => {
    setSelectedCapabilities(prev =>
      prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const borderColor = 'var(--border-color, rgba(128,128,128,0.25))';
  const mutedText = 'var(--muted-foreground, rgba(128,128,128,0.85))';

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search models..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '16px',
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            outline: 'none',
            background: 'var(--background, #fff)',
            color: 'inherit',
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: category === cat.id ? '2px solid #DD3300' : `1px solid ${borderColor}`,
              background: category === cat.id ? '#DD330015' : 'transparent',
              color: category === cat.id ? '#DD3300' : 'inherit',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: category === cat.id ? 600 : 400,
            }}
          >
            {cat.label} ({cat.count})
          </button>
        ))}
      </div>

      {/* Capability Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {capabilityFilters.map(cap => (
          <button
            key={cap}
            onClick={() => toggleCapability(cap)}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: selectedCapabilities.includes(cap) ? '1px solid #DD3300' : `1px solid ${borderColor}`,
              background: selectedCapabilities.includes(cap) ? '#DD330020' : 'transparent',
              color: selectedCapabilities.includes(cap) ? '#DD3300' : mutedText,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {cap}
          </button>
        ))}
        <button
          onClick={() => setShowBetaOnly(!showBetaOnly)}
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            border: showBetaOnly ? '1px solid #DD3300' : `1px solid ${borderColor}`,
            background: showBetaOnly ? '#DD330020' : 'transparent',
            color: showBetaOnly ? '#DD3300' : mutedText,
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Beta Only
        </button>
      </div>

      {/* Results Count */}
      <div style={{ fontSize: '14px', color: mutedText, marginBottom: '16px' }}>
        {filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''}
      </div>

      {/* Model List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredModels.map(model => (
          <div
            key={model.id}
            style={{
              padding: '16px 20px',
              border: `1px solid ${borderColor}`,
              borderRadius: '8px',
              background: 'var(--background, #fff)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: 600 }}>
                  {model.source ? (
                    <a href={model.source} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                      {model.name}
                    </a>
                  ) : model.name}
                </span>
                {model.isAnonymized && (
                  <span style={{ fontSize: '11px', padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: '4px' }}>A</span>
                )}
                {model.isBeta && (
                  <span style={{ fontSize: '11px', padding: '2px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px' }}>Beta</span>
                )}
                <button
                  onClick={() => copyToClipboard(model.id)}
                  title="Copy model ID"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.5 }}
                >
                  📋
                </button>
              </div>
              <span style={{ fontSize: '14px', color: mutedText }}>{model.context} tokens</span>
            </div>
            
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: mutedText, lineHeight: 1.4 }}>
              {model.description}
            </p>
            
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: mutedText, flexWrap: 'wrap', alignItems: 'center' }}>
              <code style={{ 
                background: 'rgba(128,128,128,0.15)', 
                padding: '3px 8px', 
                borderRadius: '4px', 
                fontSize: '12px',
                color: 'inherit'
              }}>{model.id}</code>
              <span>{model.inputPrice}/M input</span>
              <span>{model.outputPrice}{model.category === 'text' || model.category === 'embedding' ? '/M output' : ''}</span>
              {model.capabilities.length > 0 && (
                <span style={{ color: '#DD3300' }}>{model.capabilities.join(' · ')}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: mutedText }}>
          No models match your filters
        </div>
      )}
    </div>
  );
}
