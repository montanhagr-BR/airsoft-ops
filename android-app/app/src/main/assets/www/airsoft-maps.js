(function () {
  const config = window.AIRSOFT_MAPS_CONFIG || {};
  let loaderPromise = null;

  function loadGoogleMaps() {
    if (window.google && google.maps) return Promise.resolve(google.maps);
    if (!config.apiKey || config.apiKey.includes('SUA_CHAVE')) return Promise.resolve(null);
    if (loaderPromise) return loaderPromise;
    loaderPromise = new Promise((resolve, reject) => {
      const callback = '__airsoftGoogleMapsReady';
      window[callback] = () => { delete window[callback]; resolve(google.maps); };
      const script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(config.apiKey) + '&callback=' + callback + '&v=weekly&loading=async';
      script.async = true;
      script.onerror = () => reject(new Error('Não foi possível carregar o Google Maps.'));
      document.head.appendChild(script);
    });
    return loaderPromise;
  }

  function organizationColor(name) {
    const palette = ['#2979b8','#b64b3b','#4f8d52','#9a63b5','#cf8b2f','#2f9b91','#b44f7a','#7f9140','#4772c2','#b06f3e','#6f65bd','#3f9271'];
    let hash = 0;
    for (const char of String(name || 'Sem agremiação').toLowerCase()) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return palette[Math.abs(hash) % palette.length];
  }

  function areaColor(type) {
    return ({ objective:'#e4b83f', safe:'#3fa864', risk:'#dc703f', restricted:'#c94141' })[type] || '#d0b45c';
  }

  function hasPosition(point) {
    return point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
  }

  function makeMarker(maps, map, position, options) {
    return new maps.Marker({
      map, position, title: options.title,
      label: { text: options.label, color:'#ffffff', fontWeight:'900', fontSize:'11px' },
      icon: {
        path: options.shape === 'square' ? 'M -8,-8 8,-8 8,8 -8,8 z' : options.shape === 'diamond' ? 'M 0,-11 11,0 0,11 -11,0 z' : maps.SymbolPath.CIRCLE,
        fillColor: options.color, fillOpacity:.96, strokeColor:'#ffffff', strokeWeight:2,
        scale: options.shape === 'circle' ? 8 : 1
      },
      zIndex: options.zIndex || 2
    });
  }

  async function create(element, options = {}) {
    let maps;
    try { maps = await loadGoogleMaps(); } catch (error) {
      element.dataset.mapError = error.message;
      return null;
    }
    if (!maps) {
      element.dataset.mapFallback = 'true';
      return null;
    }
    element.innerHTML = '';
    element.classList.add('googleMapActive');
    const map = new maps.Map(element, {
      center: config.defaultCenter || { lat:-15.6014, lng:-56.0979 },
      zoom: Number(config.defaultZoom || 17),
      mapTypeId: 'satellite',
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy'
    });
    let overlays = [];
    let fitted = false;
    let userMoved = false;
    map.addListener('dragstart', () => { userMoved = true; });
    map.addListener('zoom_changed', () => { if (fitted) userMoved = true; });
    if (options.onClick) map.addListener('click', event => options.onClick({ lat:event.latLng.lat(), lng:event.latLng.lng() }));

    return {
      map,
      resize() { maps.event.trigger(map, 'resize'); },
      render(state, view = {}) {
        overlays.forEach(item => item.setMap(null));
        overlays = [];
        const team = view.team || null;
        const filter = view.filter || null;
        const bounds = new maps.LatLngBounds();
        const areas = (state.tacticalAreas || []).filter(area => !team || area.visibility === 'all' || area.visibility === team);
        areas.forEach(area => {
          if (!hasPosition(area)) return;
          const color = areaColor(area.type);
          const circle = new maps.Circle({
            map, center:{ lat:Number(area.lat), lng:Number(area.lng) }, radius:Number(area.radiusMeters || 50),
            strokeColor:color, strokeOpacity:.95, strokeWeight:2, fillColor:color, fillOpacity:.2,
            clickable:false
          });
          overlays.push(circle);
          bounds.extend(circle.getCenter());
        });
        ['ct','terrorist'].forEach(teamId => {
          if (team && team !== teamId) return;
          const point = (state.teamStartPositions || {})[teamId];
          if (!hasPosition(point)) return;
          const marker = makeMarker(maps, map, { lat:Number(point.lat), lng:Number(point.lng) }, {
            title:'Base de saída · ' + (teamId === 'ct' ? state.team1Name : state.team2Name),
            label:teamId === 'ct' ? 'B1' : 'B2', color:teamId === 'ct' ? '#2979b8' : '#b64b3b', shape:teamId === 'ct' ? 'circle' : 'square', zIndex:5
          });
          overlays.push(marker); bounds.extend(marker.getPosition());
        });
        (state.players || []).filter(player => player.status === 'approved' && hasPosition(player) && (!team || player.team === team) && (!filter || player.team === filter)).forEach(player => {
          const marker = makeMarker(maps, map, { lat:Number(player.lat), lng:Number(player.lng) }, {
            title:player.name + ' · ' + (player.organization || 'Sem agremiação'), label:String(player.name || '?').slice(0,2).toUpperCase(),
            color:organizationColor(player.organization), shape:player.team === 'ct' ? 'circle' : 'square'
          });
          overlays.push(marker); bounds.extend(marker.getPosition());
        });
        if (!team && hasPosition({ lat:state.locatorArtifactLat, lng:state.locatorArtifactLng })) {
          const marker = makeMarker(maps, map, { lat:Number(state.locatorArtifactLat), lng:Number(state.locatorArtifactLng) }, {
            title:state.locatorArtifactName || 'Artefato', label:'A', color:'#c69b2b', shape:'diamond', zIndex:6
          });
          overlays.push(marker); bounds.extend(marker.getPosition());
        }
        if (!fitted && !bounds.isEmpty() && !userMoved) {
          map.fitBounds(bounds, 56);
          fitted = true;
        }
      }
    };
  }

  window.AirsoftMaps = { create };
})();
