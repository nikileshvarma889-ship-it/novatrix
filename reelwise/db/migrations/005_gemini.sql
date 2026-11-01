-- Google Gemini as an alternative AI provider. ai_provider: null = automatic, 'claude' or 'gemini'.
alter table workspace_settings add column if not exists gemini_key_enc text;
alter table workspace_settings add column if not exists ai_provider text check (ai_provider in ('claude', 'gemini'));
