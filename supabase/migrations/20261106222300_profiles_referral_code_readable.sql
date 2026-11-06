-- Fresh App Store installs first run the app as built (Nov 3), whose profile load selects
-- referral_code; hiding that column made sign-in look broken until the next launch. Invite codes
-- are no longer friend links (those use the hidden friend_code), so members may read them again.
grant select (referral_code) on public.profiles to authenticated;
