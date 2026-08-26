# Instagram APK Analysis — Raw Data

## Version Info
- Package: com.instagram.android
- Version: 443.0.0.48.82 (Build 384910626)
- Min SDK: 28, Target SDK: 36
- Split APK: base (143MB) + arservices + executorch + pytorch + spm

## Deep Link Schemes
- https:// (instagram.com, ig.me, instagr.am, www.instagram.com, m.instagram.com)
- instagram:// (custom app scheme)
- ig:// (internal scheme)

## 400+ Registered Deep Link Hosts
See manifest_raw.txt for full list. Critical ones:
- media, reels, profile, explore, direct-inbox, direct-thread
- create_post, story-camera, settings, saved
- search, user, tag, location

## Key Engagement Resource IDs
- row_feed_button_like (content-desc="Like" / "Unlike")
- row_feed_button_comment (content-desc="Comment")
- row_feed_button_share (content-desc="Send post...")
- row_feed_button_save (content-desc="Add to Saved")
- inline_follow_button (content-desc="Follow {name}")
- media_option_button (content-desc="More actions...")
- row_feed_view_group_buttons (parent container for action buttons)
- row_feed_photo_imageview (the post image/video)
- row_feed_profile_header (post author header)
- row_feed_photo_profile_name (author name text)
- reposts_ufi_icon (repost/remix button)

## Tab Bar Resource IDs
- feed_tab (Home)
- clips_tab (Reels)
- direct_tab (Message/DM)
- search_tab (Search and explore)
- profile_tab (Profile)

## Key Activities
- com.instagram.mainactivity.LauncherActivity (entry)
- com.instagram.mainactivity.InstagramMainActivity (main host)
- com.meta.foa.deeplink.FoaDeeplinkActivityAliasUniversalLink (https handler)
- com.meta.foa.deeplink.FoaDeeplinkActivityAliasAppScheme (instagram:// handler)
- com.instagram.url.UrlHandlerActivity (url routing)
- com.instagram.direct.share.handler.DirectExternalMediaShareActivity (share to DM)

## Files
- manifest_raw.txt: Full aapt2 xmltree dump (6195 lines)
- ig_post_dump4.xml: UI hierarchy of a loaded feed post with engagement buttons visible
- instagram-base.apk: Base APK pulled from Samsung S24 Ultra
