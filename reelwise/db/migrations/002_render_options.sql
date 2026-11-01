-- Per-video render choices: {voice, voiceoverMediaId, music, musicVolume}
alter table videos add column render_options jsonb not null default '{}';
