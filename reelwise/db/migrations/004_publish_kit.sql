-- Claude-written publishing kit (titles, description, caption, hashtags, cover design) and the
-- rendered timeline (scene start times) used for chapters and cover frames.
alter table videos add column if not exists publish_kit jsonb;
alter table videos add column if not exists timeline jsonb;
