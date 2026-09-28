# Quality Badges for Jellyfin

Compact quality labels on Movie and Episode poster cards. Series cards are intentionally excluded because episodes can have different media quality.

## Install with JellyFrame

In **Dashboard → Mods → Marketplace**, add this **Mod Repository URL**:

```text
https://raw.githubusercontent.com/rodion981/jellyfin-quality-badges/main/mods.json
```

Load the repository, enable **Quality Badges**, click **Save & Apply**, then hard-refresh Jellyfin Web. Open a media library and click the **Quality Badges** gear next to Jellyfin's view controls. One panel lists your available libraries and groups badge checkboxes under Resolution, Dynamic Range, Video Codec, and Audio. Settings are saved separately for each user in that browser.

The mod reads media metadata from the current Jellyfin server through `ApiClient`. It does not send metadata to another service. Each item uses one cached media metadata request. When library filtering is enabled on a mixed page, the mod may also request and cache the item's parent ancestry to identify its library.

Supported labels: 4K, 1080p, 720p, SD; DV, HDR10+, HDR10, HLG; HEVC, AV1, AVC; Atmos, DTS:X, TrueHD, DTS-HD MA, DTS, DD+, DD, FLAC, AAC. SDR has no label. Dolby Vision can appear together with HDR fallback.

## Українською

Мод показує компактні позначки якості на постерах фільмів та епізодів. На картках серіалів позначок немає, бо епізоди можуть мати різну якість.

У **Панель керування → Моди → Marketplace** додайте URL із блоку вище, завантажте репозиторій і ввімкніть **Quality Badges**. Після **Save & Apply** оновіть Jellyfin Web через Ctrl+Shift+R.

Щоб вибрати медіатеки та позначки, відкрийте будь-яку медіатеку й натисніть шестерню **Quality Badges** біля налаштувань вигляду. У спільній панелі є список ваших медіатек і галочки в групах Resolution, Dynamic Range, Video Codec та Audio. Вибір зберігається для поточного користувача в цьому браузері. JellyFrame не підтримує групи або динамічні списки медіатек у стандартній формі мода.
