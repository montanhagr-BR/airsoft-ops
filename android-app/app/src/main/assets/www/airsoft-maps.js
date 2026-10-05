(function () {
  const config = window.AIRSOFT_MAPS_CONFIG || {};
  let loaderPromise = null;
  let leafletPromise = null;

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

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('Falha ao carregar Leaflet.'));
      document.head.appendChild(script);
    });
    return leafletPromise;
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
    return point && point.lat != null && point.lng != null && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

  async function createLeafletMap(element, options = {}) {
    let L;
    try { L = await loadLeaflet(); } catch (e) { return null; }
    element.innerHTML = '';
    element.classList.add('googleMapActive');

    const defaultCenter = config.defaultCenter || { lat:-15.6014, lng:-56.0979 };
    const map = L.map(element, {
      center: [defaultCenter.lat, defaultCenter.lng],
      zoom: Number(config.defaultZoom || 17),
      zoomControl: true
    });

    // Esri World Imagery high-resolution satellite tiles (Free, No API Key needed)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri Satellite'
    }).addTo(map);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 18);
      }, () => {}, { timeout: 6000 });
    }

    if (options.onClick) {
      map.on('click', e => options.onClick({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }

    let layers = [];
    let fitted = false;

    return {
      map,
      resize() { map.invalidateSize(); },
      render(state, view = {}) {
        layers.forEach(l => map.removeLayer(l));
        layers = [];
        const team = view.team || null;
        const filter = view.filter || null;
        const field = state.fieldBoundary || { points: [], closed: false };
        const fieldPath = field.points.filter(hasPosition).map(p => [Number(p.lat), Number(p.lng)]);

        if (fieldPath.length >= 2) {
          const poly = field.closed && fieldPath.length >= 3
            ? L.polygon(fieldPath, { color:'#ef6817', weight:3, fillColor:'#ef6817', fillOpacity:0.15 }).addTo(map)
            : L.polyline(fieldPath, { color:'#ef6817', weight:3 }).addTo(map);
          layers.push(poly);
        }

        const activePts = (state.activeDrawingPoints || []).filter(hasPosition).map(p => [Number(p.lat), Number(p.lng)]);
        if (activePts.length) {
          const line = L.polyline(activePts, { color:'#e4b83f', weight:3, opacity:0.9 }).addTo(map);
          layers.push(line);
          activePts.forEach(pt => {
            const circle = L.circleMarker(pt, { radius:5, color:'#ffffff', fillColor:'#e4b83f', fillOpacity:1, weight:1 }).addTo(map);
            layers.push(circle);
          });
        }

        const areas = (state.tacticalAreas || []).filter(area => !team || area.visibility === 'all' || area.visibility === team);
        areas.forEach(area => {
          const color = areaColor(area.type);
          if (area.points && area.points.length >= 3) {
            const polyPts = area.points.filter(hasPosition).map(p => [Number(p.lat), Number(p.lng)]);
            if (polyPts.length >= 3) {
              const poly = L.polygon(polyPts, { color: color, weight: 2, fillColor: color, fillOpacity: 0.28 }).addTo(map);
              layers.push(poly);

              const cLat = polyPts.reduce((sum, p) => sum + p[0], 0) / polyPts.length;
              const cLng = polyPts.reduce((sum, p) => sum + p[1], 0) / polyPts.length;
              const textIcon = L.divIcon({
                className: 'leafletAreaLabel',
                html: `<div style="background:${color};color:#fff;font-weight:900;font-size:11px;padding:2px 6px;border-radius:10px;border:1px solid #fff;white-space:nowrap;box-shadow:0 0 6px #000">${escapeHtml(area.name || 'Área')}</div>`,
                iconSize: [80, 20],
                iconAnchor: [40, 10]
              });
              const marker = L.marker([cLat, cLng], { icon: textIcon }).addTo(map);
              layers.push(marker);
            }
          }
        });

        // Bases
        ['ct','terrorist'].forEach(teamId => {
          if (team && team !== teamId) return;
          const p = (state.teamStartPositions || {})[teamId];
          if (hasPosition(p)) {
            const baseColor = teamId === 'ct' ? '#2979b8' : '#b64b3b';
            const icon = L.divIcon({
              className: 'leafletBaseLabel',
              html: `<div style="background:${baseColor};color:#fff;font-weight:900;font-size:11px;padding:3px 7px;border-radius:4px;border:2px solid #fff;box-shadow:0 0 8px #000">${teamId === 'ct' ? 'BASE B1' : 'BASE B2'}</div>`,
              iconSize: [60, 24],
              iconAnchor: [30, 12]
            });
            const m = L.marker([Number(p.lat), Number(p.lng)], { icon }).addTo(map);
            layers.push(m);
          }
        });

        // Players
        (state.players || []).filter(player => player.status === 'approved' && hasPosition(player) && (!team || player.team === team) && (!filter || player.team === filter)).forEach(player => {
          const color = organizationColor(player.organization);
          const icon = L.divIcon({
            className: 'leafletPlayerLabel',
            html: `<div style="background:${color};color:#fff;font-weight:900;font-size:10px;padding:2px 5px;border-radius:12px;border:1.5px solid #fff;white-space:nowrap;box-shadow:0 0 6px #000">${escapeHtml(player.name.slice(0,10))}</div>`,
            iconSize: [60, 20],
            iconAnchor: [30, 10]
          });
          const m = L.marker([Number(player.lat), Number(player.lng)], { icon }).addTo(map);
          layers.push(m);
        });

        // 50% Field Region Restriction for Player Terminal
        if (view.restrictToField) {
          let rePts = fieldPath;
          if (!rePts.length) {
            (state.tacticalAreas || []).forEach(area => {
              if (area.points) area.points.filter(hasPosition).forEach(p => rePts.push([Number(p.lat), Number(p.lng)]));
            });
          }
          if (rePts.length >= 2) {
            const lats = rePts.map(p => p[0]);
            const lngs = rePts.map(p => p[1]);
            const minLat = Math.min(...lats), maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
            const latSpan = Math.max(0.002, maxLat - minLat);
            const lngSpan = Math.max(0.002, maxLng - minLng);
            const paddedBounds = L.latLngBounds(
              [minLat - latSpan * 0.5, minLng - lngSpan * 0.5],
              [maxLat + latSpan * 0.5, maxLng + lngSpan * 0.5]
            );
            map.setMaxBounds(paddedBounds);
            if (!fitted) {
              map.fitBounds(paddedBounds, { padding: [20, 20] });
              fitted = true;
            }
          }
        } else if (!fitted && (fieldPath.length >= 2 || layers.length > 0)) {
          const group = L.featureGroup(layers);
          if (group.getBounds().isValid()) {
            map.fitBounds(group.getBounds(), { padding: [30, 30] });
            fitted = true;
          }
        }
      }
    };
  }

  async function create(element, options = {}) {
    let maps;
    try { maps = await loadGoogleMaps(); } catch (_) { maps = null; }
    if (!maps) {
      // Automatic fallback to Esri World Imagery Satellite Map (100% Free, No API Key needed)
      return createLeafletMap(element, options);
    }
    element.innerHTML = '';
    element.classList.add('googleMapActive');

    const defaultCenter = config.defaultCenter || { lat:-15.6014, lng:-56.0979 };
    const map = new maps.Map(element, {
      center: defaultCenter,
      zoom: Number(config.defaultZoom || 17),
      mapTypeId: 'satellite',
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy'
    });

    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(position => {
          map.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        }, () => {}, { timeout: 6000, maximumAge: 60000 });
      } catch (_) {}
    }

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
        const field = state.fieldBoundary || { points: [], closed: false };
        const fieldPath = field.points.filter(hasPosition).map(p => ({ lat:Number(p.lat), lng:Number(p.lng) }));
        if (fieldPath.length) {
          const settings = { map, strokeColor:'#ef6817', strokeWeight:3, clickable:false };
          const contour = field.closed && fieldPath.length >= 3
            ? new maps.Polygon({ ...settings, paths:fieldPath, fillColor:'#ef6817', fillOpacity:.12 })
            : new maps.Polyline({ ...settings, path:fieldPath });
          overlays.push(contour);
          fieldPath.forEach(point => bounds.extend(point));
        }

        const drawingPoints = (state.activeDrawingPoints || []).filter(hasPosition).map(p => ({ lat:Number(p.lat), lng:Number(p.lng) }));
        if (drawingPoints.length) {
          const draftLine = new maps.Polyline({
            map, path: drawingPoints, strokeColor: '#e4b83f', strokeWeight: 3, strokeOpacity: 0.9,
            clickable: false
          });
          overlays.push(draftLine);
          drawingPoints.forEach(pt => {
            const dot = new maps.Marker({ map, position: pt, icon: { path: maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#e4b83f', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1 }, zIndex: 10 });
            overlays.push(dot);
            bounds.extend(pt);
          });
        }

        if (!team && hasPosition(state.fieldArtifact)) {
          const point = { lat:Number(state.fieldArtifact.lat), lng:Number(state.fieldArtifact.lng) };
          overlays.push(makeMarker(maps, map, point, { title:'Posição planejada do artefato', label:'A', color:'#c69b2b', shape:'diamond', zIndex:6 }));
          bounds.extend(point);
        }
        const areas = (state.tacticalAreas || []).filter(area => !team || area.visibility === 'all' || area.visibility === team);
        areas.forEach(area => {
          const color = areaColor(area.type);
          if (area.points && area.points.length >= 3) {
            const polyPath = area.points.filter(hasPosition).map(p => ({ lat:Number(p.lat), lng:Number(p.lng) }));
            if (polyPath.length >= 3) {
              const polygon = new maps.Polygon({
                map, paths: polyPath,
                strokeColor: color, strokeOpacity: 0.95, strokeWeight: 2,
                fillColor: color, fillOpacity: 0.28,
                clickable: false
              });
              overlays.push(polygon);
              polyPath.forEach(pt => bounds.extend(pt));

              const centerLat = polyPath.reduce((sum, p) => sum + p.lat, 0) / polyPath.length;
              const centerLng = polyPath.reduce((sum, p) => sum + p.lng, 0) / polyPath.length;
              const nameMarker = new maps.Marker({
                map,
                position: { lat: centerLat, lng: centerLng },
                label: { text: area.name || 'Área', color: '#ffffff', fontWeight: '900', fontSize: '13px' },
                icon: {
                  path: maps.SymbolPath.CIRCLE,
                  fillColor: color,
                  fillOpacity: 0.92,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  scale: 10
                },
                zIndex: 6
              });
              overlays.push(nameMarker);
            }
          } else if (hasPosition(area)) {
            const circle = new maps.Circle({
              map, center:{ lat:Number(area.lat), lng:Number(area.lng) }, radius:Number(area.radiusMeters || 50),
              strokeColor:color, strokeOpacity:.95, strokeWeight:2, fillColor:color, fillOpacity:.2,
              clickable:false
            });
            overlays.push(circle);
            bounds.extend(circle.getCenter());

            const circleMarker = new maps.Marker({
              map,
              position: circle.getCenter(),
              label: { text: area.name || 'Área', color: '#ffffff', fontWeight: '900', fontSize: '13px' },
              icon: {
                path: maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 0.92,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 10
              },
              zIndex: 6
            });
            overlays.push(circleMarker);
          }
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

        if (view.restrictToField) {
          let restrictionPoints = [...fieldPath];
          if (!restrictionPoints.length) {
            (state.tacticalAreas || []).forEach(area => {
              if (area.points) area.points.filter(hasPosition).forEach(p => restrictionPoints.push({ lat:Number(p.lat), lng:Number(p.lng) }));
            });
          }
          if (restrictionPoints.length >= 2) {
            const lats = restrictionPoints.map(p => p.lat);
            const lngs = restrictionPoints.map(p => p.lng);
            const minLat = Math.min(...lats), maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
            const latSpan = Math.max(0.002, maxLat - minLat);
            const lngSpan = Math.max(0.002, maxLng - minLng);
            const paddedBounds = {
              south: minLat - latSpan * 0.5,
              north: maxLat + latSpan * 0.5,
              west: minLng - lngSpan * 0.5,
              east: maxLng + lngSpan * 0.5
            };
            map.setOptions({
              restriction: {
                latLngBounds: paddedBounds,
                strictBounds: false
              },
              minZoom: 14
            });
            if (!userMoved) {
              map.fitBounds(paddedBounds, 24);
              fitted = true;
            }
          }
        } else if (!fitted && !bounds.isEmpty() && !userMoved) {
          map.fitBounds(bounds, 56);
          fitted = true;
        }
      }
    };
  }

  window.AirsoftMaps = { create };
})();
