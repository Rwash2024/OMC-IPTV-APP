# Smart TV builds (Samsung and LG)

```bash
npm run build:tv
```

This writes:

| Output | What it is |
|---|---|
| `tv/build/tizen/` | Samsung (Tizen) project folder |
| `release/OMC-IPTV-tizen-project.zip` | The same folder zipped |
| `release/com.omc.iptv_<version>_all.ipk` | LG (webOS) installable package |

**None of this has been tried on a real TV yet.** Test on one TV of each brand before giving it to customers (see "Things to check" below).

## LG (webOS)

1. On the TV, install the **Developer Mode** app from the LG Content Store and sign in with an LG developer account. Turn on **Dev Mode Status** and **Key Server**.
2. On the computer (same network), in the project folder:

```bash
npx ares-setup-device            # add the TV: name "tv", its IP address, port 9922, user "prisoner"
npx ares-novacom --device tv --getkey    # follow the passphrase shown in the Developer Mode app
npx ares-install --device tv release\com.omc.iptv_0.2.0_all.ipk
npx ares-launch --device tv com.omc.iptv
```

For many customers, LG apps are normally published through the LG Content Store (it needs an LG Seller account).

## Samsung (Tizen)

1. Install **Tizen Studio** with the **TV Extensions**.
2. In Tizen Studio's **Certificate Manager** create a **Samsung** certificate (it asks you to sign in with a Samsung account) and add the TV's DUID.
3. On the TV: Apps, then type `12345`, switch **Developer mode** on and enter the computer's IP address. Restart the TV.
4. In Tizen Studio: **Device Manager**, connect to the TV. Then **File, Open Projects from File System**, pick `tv/build/tizen`, right-click the project and **Run As, Tizen Web Application**.

Customers normally get Samsung apps from the Samsung Seller Office (Samsung App Store), which needs a Samsung Seller account.

## Things to check on a real TV

- **Playlists and streams load** (TV browsers enforce the same cross-site rules as Chrome; the Samsung package asks for open access in `config.xml`, LG has no such setting). If lists stay empty, the TV is blocking the provider's server and a small relay is needed.
- **Device ID.** Samsung: shows the TV's MAC address (needs the `network.public` privilege). LG: the app asks LG's service for the TV's id; if that is refused, the app makes up an id that is lost when the app is reinstalled.
- **Remote keys.** Arrows move around, OK selects, Back goes back, play/pause/stop/rewind/fast-forward control the player, Info or Yellow focuses the player controls.
- **Size.** On 1080p and 4K TVs the interface is scaled up 1.5x (`html.tv` in `src/styles.css`); change the number there if it looks too big or small.
- **Playback.** Live channels use HLS. Samsung and LG both play HLS; movies in MKV may not play on every model.

The licensing check and activation work the same as on the phone. The remote-config update screen does not apply to TVs (no APK to download).
