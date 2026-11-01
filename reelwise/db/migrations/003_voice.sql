-- ElevenLabs key (encrypted) and default voice per workspace, e.g. {"voice":"Bunty","language":"te","model":"eleven_v3"}
alter table workspace_settings add column elevenlabs_key_enc text;
alter table workspace_settings add column voice_defaults jsonb not null default '{}';
