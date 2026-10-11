/**
 * mobile/src/components/ProposalMap.tsx — map of proposals on OpenStreetMap
 * (Leaflet inside react-native-webview: open source, no API key, works in
 * Expo Go). Pins are the proposal's concept thumbnail in a sprout-green
 * frame; the selected pin turns sun-orange. Same look as the web app.
 *
 * RN → map: injectJavaScript(window.__wi.update(state)).
 * map → RN: postMessage({ type: "select", id }).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ProposalSummary } from "../api/types";
import type { LatLng } from "../lib/places";
import { config } from "../config";
import { theme } from "../theme";

export interface MapPin {
  item: ProposalSummary;
  at: LatLng;
}

interface Props {
  pins: MapPin[];
  user: LatLng | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focus?: LatLng | null;
}

// Pinned Leaflet build (same version as the web app).
const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";

function mapHtml(tileUrl: string): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
html,body,#map{margin:0;height:100%;background:${theme.colors.accentSoft}}
.leaflet-container{font-family:-apple-system,Roboto,sans-serif}
.wi-pin{background:none;border:none}
.wi-pin-inner{width:46px;height:46px;border-radius:23px;border:3px solid ${theme.colors.accent};background:#fff;overflow:hidden;box-sizing:border-box;transition:transform .16s,border-color .16s}
.wi-pin-inner img{width:100%;height:100%;object-fit:cover;display:block}
.wi-pin-tail{width:10px;height:10px;margin:-5px auto 0;background:${theme.colors.accent};transform:rotate(45deg)}
.wi-pin.selected .wi-pin-inner{border-color:${theme.colors.orange};transform:scale(1.15)}
.wi-pin.selected .wi-pin-tail{background:${theme.colors.orange}}
.wi-me{width:18px;height:18px;border-radius:9px;background:#2F5D8A;border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 0 6px rgba(47,93,138,.25)}
</style></head><body><div id="map"></div>
<script src="${LEAFLET}/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function(){
  var send=function(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m))};
  if(!window.L){send({type:"error"});return;}
  var map=L.map("map",{zoomControl:false}).setView([33.7756,-84.3963],12);
  L.tileLayer(${JSON.stringify(tileUrl)},{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  map.on("click",function(){send({type:"select",id:null})});
  var pins=L.layerGroup().addTo(map),me=null,fitted=false;
  var esc=function(s){return String(s).replace(/[&"<>]/g,function(c){return{"&":"&amp;","\\"":"&quot;","<":"&lt;",">":"&gt;"}[c]})};
  window.__wi={
    update:function(s){
      pins.clearLayers();
      s.pins.forEach(function(p){
        var sel=p.id===s.selectedId;
        L.marker([p.lat,p.lng],{zIndexOffset:sel?1000:0,title:p.title,icon:L.divIcon({
          className:"wi-pin"+(sel?" selected":""),
          html:'<div class="wi-pin-inner"><img src="'+esc(p.img)+'"></div><div class="wi-pin-tail"></div>',
          iconSize:[46,51],iconAnchor:[23,51]})})
        .on("click",function(e){L.DomEvent.stopPropagation(e);send({type:"select",id:p.id})}).addTo(pins);
      });
      if(me){me.remove();me=null;}
      if(s.user){me=L.marker([s.user.lat,s.user.lng],{interactive:false,keyboard:false,icon:L.divIcon({className:"",html:'<div class="wi-me"></div>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(map);}
      if(!fitted){
        var pts=s.pins.map(function(p){return[p.lat,p.lng]});
        if(s.user)pts.push([s.user.lat,s.user.lng]);
        if(pts.length===1){fitted=true;map.setView(pts[0],14);}
        else if(pts.length>1){fitted=true;map.fitBounds(pts,{padding:[60,60],maxZoom:15});}
      }
    },
    focus:function(lat,lng){map.flyTo([lat,lng],15,{duration:.45})}
  };
  send({type:"ready"});
})();
</script></body></html>`;
}

export function ProposalMap({ pins, user, selectedId, onSelect, focus }: Props) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => mapHtml(config.mapTileUrl), []);

  const state = useMemo(
    () =>
      JSON.stringify({
        selectedId,
        user: user ? { lat: user.latitude, lng: user.longitude } : null,
        pins: pins.map(({ item, at }) => ({
          id: item.id,
          title: item.title,
          img: item.conceptThumbUrl ?? item.sourceThumbUrl,
          lat: at.latitude,
          lng: at.longitude,
        })),
      }),
    [pins, user, selectedId]
  );

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.__wi&&window.__wi.update(${state});true;`);
  }, [ready, state]);

  useEffect(() => {
    if (ready && focus) web.current?.injectJavaScript(`window.__wi&&window.__wi.focus(${focus.latitude},${focus.longitude});true;`);
  }, [ready, focus]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; id?: string | null };
      if (msg.type === "ready") setReady(true);
      else if (msg.type === "select") onSelect(msg.id ?? null);
    } catch {
      // Ignore anything that isn't ours.
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]} accessibilityLabel="Map of proposals">
      <WebView
        ref={web}
        // The https base gives tile requests a Referer (the OSM tile policy needs one).
        source={{ html, baseUrl: "https://whatif.local/" }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        // Fixture-mode thumbnails are local/dev-server images.
        mixedContentMode="always"
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        setSupportMultipleWindows={false}
        bounces={false}
        overScrollMode="never"
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: theme.colors.accentSoft },
  web: { flex: 1, backgroundColor: theme.colors.accentSoft },
});
