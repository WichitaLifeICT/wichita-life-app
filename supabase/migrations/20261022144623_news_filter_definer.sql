-- The news filter trigger ran with the caller's rights, and the sync job's role can't use the
-- private schema, so every new headline failed to save. Run it with its owner's rights instead.
alter function private.filter_news_item() security definer;
