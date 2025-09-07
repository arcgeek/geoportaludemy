/**
 * Geoportal Loja - Sistema de Información Geográfica
 * Versión Moderna 2.0
 */

class GeoportalLoja {
    constructor() {
        this.map = null;
        this.layerGroups = {};
        this.barrios = [];
        this.modoReporte = false;
        this.ubicacionReporte = null;
        this.markerTemporal = null;
        this.sidebarCollapsed = false;
        
        // Configuración de Supabase
        this.supabaseUrl = 'https://cmcrdowiftjvdilvylcf.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtY3Jkb3dpZnRqdmRpbHZ5bGNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTUyODIsImV4cCI6MjA3MTg5MTI4Mn0.4v7ku49bajdVVtpz3uClR9nTpg6TP_RdGr8aqyuXmTM';
        
        // Configuración de capas
        this.capas = {
            'bomberos_wgs84': { 
                nombre: 'Estaciones de Bomberos', 
                color: '#ef4444', 
                icon: 'fas fa-fire-extinguisher',
                activa: true,
                tipo: 'point'
            },
            'policia_wgs84': { 
                nombre: 'Estaciones de Policía', 
                color: '#3b82f6', 
                icon: 'fas fa-shield-alt',
                activa: true,
                tipo: 'point'
            },
            'salud_wgs84': { 
                nombre: 'Centros de Salud', 
                color: '#10b981', 
                icon: 'fas fa-hospital',
                activa: true,
                tipo: 'point'
            },
            'reportes': { 
                nombre: 'Reportes Ciudadanos', 
                color: '#f59e0b', 
                icon: 'fas fa-exclamation-triangle',
                activa: true,
                tipo: 'point'
            },
            'barrios': { 
                nombre: 'Límites de Barrios', 
                color: '#8b5cf6', 
                icon: 'fas fa-map',
                activa: false,
                tipo: 'polygon'
            },
            'agua_potable': { 
                nombre: 'Red de Agua Potable', 
                color: '#06b6d4', 
                icon: 'fas fa-tint',
                activa: false,
                tipo: 'polygon'
            },
            'alcantarillado2': { 
                nombre: 'Red de Alcantarillado', 
                color: '#84cc16', 
                icon: 'fas fa-water',
                activa: false,
                tipo: 'line'
            }
        };
        
        this.estadisticas = {
            'total-reportes': 0,
            'total-barrios': 0,
            'servicios-salud': 0,
            'estaciones-policia': 0
        };
        
        this.init();
    }
    
    /**
     * Inicialización del geoportal
     */
    async init() {
        try {
            this.showLoading(true);
            this.initMap();
            this.initEventListeners();
            this.createLayerControls();
            await this.cargarBarrios();
            await this.cargarCapasDefecto();
            await this.actualizarEstadisticas();
            this.showStatus('success', 'Geoportal cargado correctamente', false);
        } catch (error) {
            console.error('Error inicializando geoportal:', error);
            this.showStatus('error', 'Error al cargar el geoportal');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Inicialización del mapa
     */
    initMap() {
        this.map = L.map('map', {
            center: [-4.0, -79.2],
            zoom: 13,
            zoomControl: false,
            attributionControl: false
        });
        
        // Agregar capa base
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // Agregar controles de zoom en posición personalizada
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
        
        // Agregar control de escala
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false
        }).addTo(this.map);
        
        // Event listeners del mapa
        this.map.on('click', (e) => this.onMapClick(e));
        this.map.on('zoomend', () => this.onMapZoomEnd());
        
        // Crear controles de basemap
        this.createBasemapControls();
    }
    
    /**
     * Crear controles de basemap
     */
    createBasemapControls() {
        const basemapConfig = {
            carto: { name: 'Carto Dark', checked: true },
            osm: { name: 'OpenStreetMap', checked: false },
            esri: { name: 'ESRI Satellite', checked: false }
        };
        
        // Agregar controles de basemap al sidebar
        const basemapSection = document.createElement('div');
        basemapSection.className = 'panel';
        basemapSection.innerHTML = `
            <div class="panel-header">
                <i class="fas fa-globe"></i>
                <h3>Mapas Base</h3>
            </div>
            <div class="panel-body">
                <div id="basemap-controls" class="basemap-container"></div>
            </div>
        `;
        
        // Insertar después del panel de capas
        const layersPanel = document.querySelector('.sidebar-content .panel:nth-child(3)');
        if (layersPanel) {
            layersPanel.insertAdjacentElement('afterend', basemapSection);
        } else {
            document.querySelector('.sidebar-content').appendChild(basemapSection);
        }
        
        const basemapContainer = document.getElementById('basemap-controls');
        
        Object.entries(basemapConfig).forEach(([key, config]) => {
            const basemapItem = document.createElement('div');
            basemapItem.className = 'basemap-item';
            basemapItem.innerHTML = `
                <input type="radio" id="basemap-${key}" name="basemap" ${config.checked ? 'checked' : ''}>
                <label for="basemap-${key}" class="basemap-label">${config.name}</label>
            `;
            
            const radio = basemapItem.querySelector('input');
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.changeBasemap(key);
                }
            });
            
            basemapContainer.appendChild(basemapItem);
        });
    }
    
    /**
     * Cambiar basemap
     */
    changeBasemap(basemapKey) {
        if (this.currentBasemap && this.basemaps[this.currentBasemap]) {
            this.map.removeLayer(this.basemaps[this.currentBasemap]);
        }
        
        if (this.basemaps[basemapKey]) {
            this.basemaps[basemapKey].addTo(this.map);
            this.currentBasemap = basemapKey;
            
            const basemapNames = {
                carto: 'Carto Dark',
                osm: 'OpenStreetMap',
                esri: 'ESRI Satellite'
            };
            
            this.showStatus('success', `Mapa base cambiado a ${basemapNames[basemapKey]}`);
        }
    }
    
    /**
     * Inicialización de event listeners
     */
    initEventListeners() {
        // Toggle sidebar
        document.getElementById('toggle-sidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        // Búsqueda de barrios
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            this.buscarBarrios(e.target.value);
        });
        
        // Detección de dispositivos móviles
        if (window.innerWidth <= 768) {
            this.sidebarCollapsed = true;
            document.getElementById('sidebar').classList.add('collapsed');
        }
        
        // Resize handler
        window.addEventListener('resize', () => {
            if (this.map) {
                this.map.invalidateSize();
            }
        });
    }
    
    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        this.sidebarCollapsed = !this.sidebarCollapsed;
        
        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
        
        // Invalidar tamaño del mapa después de la transición
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
            }
        }, 300);
    }
    
    /**
     * Crear controles de capas
     */
    createLayerControls() {
        const layersContainer = document.getElementById('layers');
        layersContainer.innerHTML = '';
        
        Object.entries(this.capas).forEach(([key, capa]) => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.innerHTML = `
                <input type="checkbox" id="layer-${key}" ${capa.activa ? 'checked' : ''}>
                <span class="layer-icon" style="background-color: ${capa.color};"></span>
                <label for="layer-${key}" class="layer-label">${capa.nombre}</label>
            `;
            
            const checkbox = layerItem.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                this.toggleCapa(key, e.target.checked);
            });
            
            layersContainer.appendChild(layerItem);
        });
    }
    
    /**
     * Cargar capas por defecto
     */
    async cargarCapasDefecto() {
        const promesas = [];
        
        for (const [key, capa] of Object.entries(this.capas)) {
            if (capa.activa) {
                promesas.push(this.cargarCapa(key));
            }
        }
        
        await Promise.all(promesas);
    }
    
    /**
     * Toggle capa
     */
    async toggleCapa(key, visible) {
        try {
            if (visible) {
                await this.cargarCapa(key);
            } else {
                this.removerCapa(key);
            }
        } catch (error) {
            console.error(`Error toggling capa ${key}:`, error);
            this.showStatus('error', `Error al cargar ${this.capas[key].nombre}`);
        }
    }
    
    /**
     * Cargar capa específica
     */
    async cargarCapa(key) {
        if (this.layerGroups[key]) {
            this.removerCapa(key);
        }
        
        this.showStatus('info', `Cargando ${this.capas[key].nombre}...`, false);
        
        try {
            if (key === 'reportes') {
                await this.cargarReportes();
                return;
            }
            
            const response = await fetch(`${this.supabaseUrl}/rest/v1/${key}?select=*&limit=1000`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const layerGroup = L.layerGroup();
            let contador = 0;
            
            data.forEach(item => {
                if (item.geom) {
                    try {
                        const geom = typeof item.geom === 'string' ? JSON.parse(item.geom) : item.geom;
                        const layer = this.createLayerFromGeometry(geom, this.capas[key], item);
                        if (layer) {
                            layerGroup.addLayer(layer);
                            contador++;
                        }
                    } catch (e) {
                        console.warn(`Error procesando geometría en ${key}:`, e);
                    }
                }
            });
            
            this.layerGroups[key] = layerGroup;
            layerGroup.addTo(this.map);
            
            this.showStatus('success', `${this.capas[key].nombre}: ${contador} elementos cargados`);
            
        } catch (error) {
            console.error(`Error cargando capa ${key}:`, error);
            this.showStatus('error', `Error cargando ${this.capas[key].nombre}`);
        }
    }
    
    /**
     * Crear layer desde geometría
     */
    createLayerFromGeometry(geom, capaConfig, properties) {
        const style = {
            color: capaConfig.color,
            weight: 2,
            fillOpacity: 0.3,
            opacity: 0.8
        };
        
        return L.geoJSON(geom, {
            style: style,
            pointToLayer: (feature, latlng) => {
                const marker = L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: capaConfig.color,
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
                
                // Agregar popup con información
                if (properties) {
                    marker.bindPopup(this.createPopupContent(properties, capaConfig));
                }
                
                return marker;
            },
            onEachFeature: (feature, layer) => {
                if (properties && capaConfig.tipo !== 'point') {
                    layer.bindPopup(this.createPopupContent(properties, capaConfig));
                }
            }
        });
    }
    
    /**
     * Crear contenido del popup
     */
    createPopupContent(properties, capaConfig) {
        let content = `<div style="min-width: 200px;">`;
        content += `<h4 style="margin: 0 0 10px 0; color: ${capaConfig.color};">`;
        content += `<i class="${capaConfig.icon}"></i> ${capaConfig.nombre}</h4>`;
        
        // Mostrar propiedades relevantes
        const propiedadesRelevantes = this.getRelevantProperties(properties);
        
        propiedadesRelevantes.forEach(([key, value]) => {
            if (value && value !== 'null' && value !== '') {
                content += `<p style="margin: 5px 0;"><strong>${key}:</strong> ${value}</p>`;
            }
        });
        
        content += `</div>`;
        return content;
    }
    
    /**
     * Obtener propiedades relevantes para mostrar
     */
    getRelevantProperties(properties) {
        const relevantKeys = {
            'nombre': 'Nombre',
            'parroquia': 'Parroquia',
            'categoria': 'Categoría',
            'tipo': 'Tipo',
            'BARRIO': 'Barrio',
            'PARROQUIAS': 'Parroquia',
            'sector': 'Sector',
            'zona': 'Zona',
            'tipo_requerimiento': 'Tipo de Reporte',
            'comentarios': 'Comentarios',
            'estado': 'Estado',
            'fecha_creacion': 'Fecha'
        };
        
        return Object.entries(properties)
            .filter(([key, value]) => relevantKeys[key] && value)
            .map(([key, value]) => [relevantKeys[key], value])
            .slice(0, 5); // Limitar a 5 propiedades
    }
    
    /**
     * Remover capa
     */
    removerCapa(key) {
        if (this.layerGroups[key]) {
            this.map.removeLayer(this.layerGroups[key]);
            delete this.layerGroups[key];
        }
    }
    
    /**
     * Cargar reportes
     */
    async cargarReportes() {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/obtener_reportes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({})
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const layerGroup = L.layerGroup();
            
            if (data.features) {
                data.features.forEach(feature => {
                    const props = feature.properties;
                    const coords = feature.geometry.coordinates;
                    
                    const marker = L.circleMarker([coords[1], coords[0]], {
                        radius: 10,
                        fillColor: this.getReportColor(props.tipo_requerimiento),
                        color: '#ffffff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                    
                    const popupContent = `
                        <div style="min-width: 250px;">
                            <h4 style="margin: 0 0 10px 0; color: #f59e0b;">
                                <i class="fas fa-exclamation-triangle"></i> ${props.tipo_requerimiento}
                            </h4>
                            <p><strong>Reportado por:</strong> ${props.nombre}</p>
                            <p><strong>Descripción:</strong> ${props.comentarios}</p>
                            <p><strong>Estado:</strong> <span style="color: ${this.getStatusColor(props.estado)};">${props.estado}</span></p>
                            <p><strong>Fecha:</strong> ${new Date(props.fecha_creacion).toLocaleDateString('es-ES')}</p>
                        </div>
                    `;
                    
                    marker.bindPopup(popupContent);
                    layerGroup.addLayer(marker);
                });
            }
            
            this.layerGroups['reportes'] = layerGroup;
            layerGroup.addTo(this.map);
            
            const count = data.features ? data.features.length : 0;
            this.showStatus('success', `Reportes: ${count} elementos cargados`);
            
        } catch (error) {
            console.error('Error cargando reportes:', error);
            this.showStatus('error', 'Error cargando reportes');
        }
    }
    
    /**
     * Obtener color del reporte según tipo
     */
    getReportColor(tipo) {
        const colores = {
            'Bache': '#ef4444',
            'Alumbrado': '#f59e0b',
            'Agua': '#06b6d4',
            'Basura': '#84cc16',
            'Alcantarillado': '#8b5cf6',
            'Seguridad': '#ef4444',
            'Otro': '#6b7280'
        };
        return colores[tipo] || '#6b7280';
    }
    
    /**
     * Obtener color del estado
     */
    getStatusColor(estado) {
        const colores = {
            'Pendiente': '#f59e0b',
            'En Proceso': '#06b6d4',
            'Resuelto': '#10b981',
            'Rechazado': '#ef4444'
        };
        return colores[estado] || '#6b7280';
    }
    
    /**
     * Cargar lista de barrios
     */
    async cargarBarrios() {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/barrios?select=BARRIO`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.barrios = [...new Set(data.map(item => item.BARRIO).filter(b => b))].sort();
            }
        } catch (error) {
            console.error('Error cargando barrios:', error);
        }
    }
    
    /**
     * Buscar barrios
     */
    buscarBarrios(query) {
        const resultsDiv = document.getElementById('search-results');
        
        if (query.length < 2) {
            resultsDiv.innerHTML = '';
            return;
        }
        
        const matches = this.barrios
            .filter(b => b.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 8);
            
        if (matches.length === 0) {
            resultsDiv.innerHTML = '<div class="search-result-item">No se encontraron barrios</div>';
            return;
        }
        
        resultsDiv.innerHTML = matches
            .map(barrio => `<div class="search-result-item" onclick="geoportal.seleccionarBarrio('${barrio}')">${barrio}</div>`)
            .join('');
    }
    
    /**
     * Seleccionar barrio
     */
    async seleccionarBarrio(nombre) {
        document.getElementById('search-input').value = nombre;
        document.getElementById('search-results').innerHTML = '';
        
        this.showStatus('info', 'Analizando barrio...', false);
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/analizar_barrio_completo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({ nombre_barrio: nombre })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const resultado = await response.json();
            
            if (!resultado.error) {
                this.mostrarInfoBarrio(resultado);
                this.showStatus('success', 'Análisis completado');
            } else {
                this.showStatus('error', 'Error en el análisis del barrio');
            }
            
        } catch (error) {
            console.error('Error analizando barrio:', error);
            this.showStatus('error', 'Error analizando barrio');
        }
    }
    
    /**
     * Mostrar información del barrio
     */
    mostrarInfoBarrio(info) {
        const barrioInfoDiv = document.getElementById('barrio-info');
        
        barrioInfoDiv.innerHTML = `
            <h4>${info.barrio}</h4>
            <div class="barrio-info-item">
                <span class="barrio-info-label">
                    <i class="fas fa-water"></i> Alcantarillado
                </span>
                <span class="barrio-info-value">${info.longitud_alcantarillado || 0} m</span>
            </div>
            <div class="barrio-info-item">
                <span class="barrio-info-label">
                    <i class="fas fa-fire-extinguisher"></i> Bomberos
                </span>
                <span class="barrio-info-value">${info.bomberos || 0}</span>
            </div>
            <div class="barrio-info-item">
                <span class="barrio-info-label">
                    <i class="fas fa-shield-alt"></i> Policía
                </span>
                <span class="barrio-info-value">${info.policia || 0}</span>
            </div>
            <div class="barrio-info-item">
                <span class="barrio-info-label">
                    <i class="fas fa-hospital"></i> Salud
                </span>
                <span class="barrio-info-value">${info.salud || 0}</span>
            </div>
        `;
        
        barrioInfoDiv.style.display = 'block';
    }
    
    /**
     * Event handler para click en el mapa
     */
    onMapClick(e) {
        if (this.modoReporte) {
            this.seleccionarUbicacion(e.latlng);
        } else {
            this.calcularDistancias(e.latlng);
        }
    }
    
    /**
     * Event handler para zoom del mapa
     */
    onMapZoomEnd() {
        // Ajustar el tamaño de los marcadores según el zoom
        const zoom = this.map.getZoom();
        const radius = Math.max(5, Math.min(15, zoom - 8));
        
        Object.values(this.layerGroups).forEach(layerGroup => {
            layerGroup.eachLayer(layer => {
                if (layer instanceof L.CircleMarker) {
                    layer.setRadius(radius);
                }
            });
        });
    }
    
    /**
     * Obtener ubicación del usuario
     */
    obtenerUbicacion() {
        if (!navigator.geolocation) {
            this.showStatus('error', 'Geolocalización no disponible en este navegador');
            return;
        }
        
        this.showStatus('info', 'Obteniendo ubicación...', false);
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutos
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.ubicacionReporte = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                this.agregarMarkerTemporal(this.ubicacionReporte);
                this.map.setView([this.ubicacionReporte.lat, this.ubicacionReporte.lng], 16);
                this.mostrarFormularioReporte();
                this.showStatus('success', 'Ubicación obtenida correctamente');
            },
            (error) => {
                let mensaje = 'Error obteniendo ubicación';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        mensaje = 'Permiso de ubicación denegado';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        mensaje = 'Ubicación no disponible';
                        break;
                    case error.TIMEOUT:
                        mensaje = 'Tiempo de espera agotado';
                        break;
                }
                this.showStatus('error', mensaje);
            },
            options
        );
    }
    
    /**
     * Activar modo de selección en mapa
     */
    activarModoMapa() {
        this.modoReporte = true;
        this.map.getContainer().style.cursor = 'crosshair';
        this.showStatus('info', 'Haga clic en el mapa para seleccionar ubicación', false);
    }
    
    /**
     * Seleccionar ubicación en el mapa
     */
    seleccionarUbicacion(latlng) {
        if (!this.modoReporte) return;
        
        this.ubicacionReporte = latlng;
        this.agregarMarkerTemporal(latlng);
        this.mostrarFormularioReporte();
        this.showStatus('success', 'Ubicación seleccionada');
    }
    
    /**
     * Agregar marker temporal
     */
    agregarMarkerTemporal(latlng) {
        if (this.markerTemporal) {
            this.map.removeLayer(this.markerTemporal);
        }
        
        this.markerTemporal = L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<i class="fas fa-map-pin" style="color: #ef4444; font-size: 24px;"></i>',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(this.map);
    }
    
    /**
     * Mostrar formulario de reporte
     */
    mostrarFormularioReporte() {
        this.modoReporte = false;
        this.map.getContainer().style.cursor = '';
        
        const formReporte = document.getElementById('form-reporte');
        const coordsDiv = document.getElementById('coords');
        
        formReporte.style.display = 'block';
        coordsDiv.textContent = `${this.ubicacionReporte.lat.toFixed(6)}, ${this.ubicacionReporte.lng.toFixed(6)}`;
        
        // Scroll al formulario en dispositivos móviles
        if (window.innerWidth <= 768) {
            formReporte.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    /**
     * Enviar reporte
     */
    async enviarReporte() {
        if (!this.ubicacionReporte) {
            this.showStatus('error', 'Debe seleccionar una ubicación');
            return;
        }
        
        const nombre = document.getElementById('nombre').value.trim();
        const tipo = document.getElementById('tipo').value;
        const comentarios = document.getElementById('comentarios').value.trim();
        
        // Validaciones
        if (!nombre) {
            this.showStatus('error', 'El nombre es obligatorio');
            document.getElementById('nombre').focus();
            return;
        }
        
        if (!tipo) {
            this.showStatus('error', 'Debe seleccionar un tipo de reporte');
            document.getElementById('tipo').focus();
            return;
        }
        
        if (!comentarios) {
            this.showStatus('error', 'La descripción es obligatoria');
            document.getElementById('comentarios').focus();
            return;
        }
        
        if (comentarios.length < 10) {
            this.showStatus('error', 'La descripción debe tener al menos 10 caracteres');
            document.getElementById('comentarios').focus();
            return;
        }
        
        this.showStatus('info', 'Enviando reporte...', false);
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/insertar_reporte`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({
                    p_nombre: nombre,
                    p_tipo_requerimiento: tipo,
                    p_comentarios: comentarios,
                    p_lat: this.ubicacionReporte.lat,
                    p_lng: this.ubicacionReporte.lng
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const resultado = await response.json();
            
            if (resultado.success !== false) {
                this.showStatus('success', 'Reporte enviado correctamente');
                this.cancelarReporte();
                
                // Recargar capa de reportes si está activa
                if (this.layerGroups['reportes']) {
                    await this.cargarReportes();
                }
                
                // Actualizar estadísticas
                await this.actualizarEstadisticas();
            } else {
                this.showStatus('error', 'Error al enviar el reporte');
            }
            
        } catch (error) {
            console.error('Error enviando reporte:', error);
            this.showStatus('error', 'Error de conexión al enviar el reporte');
        }
    }
    
    /**
     * Cancelar reporte
     */
    cancelarReporte() {
        this.modoReporte = false;
        this.ubicacionReporte = null;
        
        if (this.markerTemporal) {
            this.map.removeLayer(this.markerTemporal);
            this.markerTemporal = null;
        }
        
        // Limpiar formulario
        const formReporte = document.getElementById('form-reporte');
        formReporte.style.display = 'none';
        
        document.getElementById('nombre').value = '';
        document.getElementById('tipo').value = '';
        document.getElementById('comentarios').value = '';
        document.getElementById('coords').textContent = 'Coordenadas no seleccionadas';
        
        this.map.getContainer().style.cursor = '';
        this.showStatus('info', 'Reporte cancelado');
    }
    
    /**
     * Calcular distancias a servicios
     */
    async calcularDistancias(latlng) {
        this.showStatus('info', 'Calculando distancias a servicios...', false);
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/calcular_distancias`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({ 
                    lat_punto: latlng.lat, 
                    lng_punto: latlng.lng 
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const resultado = await response.json();
            
            // Crear marker con información de distancias
            const marker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'distance-marker',
                    html: '<i class="fas fa-crosshairs" style="color: #2563eb; font-size: 20px;"></i>',
                    iconSize: [25, 25],
                    iconAnchor: [12, 12]
                })
            }).addTo(this.map);
            
            const popupContent = `
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 15px 0; color: #2563eb;">
                        <i class="fas fa-map-marker-alt"></i> Distancias a Servicios
                    </h4>
                    <div style="display: grid; gap: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span><i class="fas fa-fire-extinguisher" style="color: #ef4444; width: 20px;"></i> Bomberos</span>
                            <strong>${Math.round(resultado.bomberos || 0)} m</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span><i class="fas fa-shield-alt" style="color: #3b82f6; width: 20px;"></i> Policía</span>
                            <strong>${Math.round(resultado.policia || 0)} m</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span><i class="fas fa-hospital" style="color: #10b981; width: 20px;"></i> Salud</span>
                            <strong>${Math.round(resultado.salud || 0)} m</strong>
                        </div>
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 0.8em; color: #666;">
                        Coordenadas: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}
                    </p>
                </div>
            `;
            
            marker.bindPopup(popupContent).openPopup();
            
            // Remover marker después de 30 segundos
            setTimeout(() => {
                this.map.removeLayer(marker);
            }, 30000);
            
            this.showStatus('success', 'Distancias calculadas');
            
        } catch (error) {
            console.error('Error calculando distancias:', error);
            this.showStatus('error', 'Error calculando distancias');
        }
    }
    
    /**
     * Actualizar estadísticas
     */
    async actualizarEstadisticas() {
        try {
            // Obtener estadísticas de cada tabla
            const estadisticas = await Promise.allSettled([
                this.obtenerConteo('reportes'),
                this.obtenerConteo('barrios'),
                this.obtenerConteo('salud_wgs84'),
                this.obtenerConteo('policia_wgs84')
            ]);
            
            // Actualizar DOM
            document.getElementById('total-reportes').textContent = estadisticas[0].value || 0;
            document.getElementById('total-barrios').textContent = estadisticas[1].value || 0;
            document.getElementById('servicios-salud').textContent = estadisticas[2].value || 0;
            document.getElementById('estaciones-policia').textContent = estadisticas[3].value || 0;
            
        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
    }
    
    /**
     * Obtener conteo de registros
     */
    async obtenerConteo(tabla) {
        try {
            let url = `${this.supabaseUrl}/rest/v1/${tabla}?select=count`;
            
            // Para reportes usar función específica
            if (tabla === 'reportes') {
                const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/obtener_reportes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`
                    },
                    body: JSON.stringify({})
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return data.features ? data.features.length : 0;
                }
                return 0;
            }
            
            const response = await fetch(url, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Prefer': 'count=exact'
                }
            });
            
            if (response.ok) {
                const countHeader = response.headers.get('Content-Range');
                if (countHeader) {
                    const match = countHeader.match(/\/(\d+)$/);
                    return match ? parseInt(match[1]) : 0;
                }
            }
            
            return 0;
        } catch (error) {
            console.error(`Error obteniendo conteo de ${tabla}:`, error);
            return 0;
        }
    }
    
    /**
     * Centrar mapa en Loja
     */
    centrarMapa() {
        this.map.setView([-4.0, -79.2], 13);
        this.showStatus('info', 'Mapa centrado en Loja');
    }
    
    /**
     * Toggle pantalla completa
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Error activando pantalla completa:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * Mostrar/ocultar loading
     */
    showLoading(show) {
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    /**
     * Mostrar status
     */
    showStatus(type, message, autoHide = true) {
        const statusPanel = document.getElementById('status');
        
        // Limpiar clases anteriores
        statusPanel.className = 'status-panel show';
        statusPanel.classList.add(type);
        
        // Agregar icono según tipo
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        statusPanel.innerHTML = `<i class="${icons[type]}"></i> ${message}`;
        
        // Auto-hide después de 5 segundos
        if (autoHide) {
            setTimeout(() => {
                statusPanel.classList.remove('show');
            }, 5000);
        }
        
        // Scroll al status en móviles si es error
        if (type === 'error' && window.innerWidth <= 768) {
            statusPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    /**
     * Limpiar status
     */
    clearStatus() {
        const statusPanel = document.getElementById('status');
        statusPanel.classList.remove('show');
    }
}

// Funciones globales para compatibilidad
let geoportal;

function obtenerUbicacion() {
    geoportal.obtenerUbicacion();
}

function activarModoMapa() {
    geoportal.activarModoMapa();
}

function enviarReporte() {
    geoportal.enviarReporte();
}

function cancelarReporte() {
    geoportal.cancelarReporte();
}

function centrarMapa() {
    geoportal.centrarMapa();
}

function toggleFullscreen() {
    geoportal.toggleFullscreen();
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    geoportal = new GeoportalLoja();
});

// Manejar errores globales
window.addEventListener('error', function(event) {
    console.error('Error global:', event.error);
    if (geoportal) {
        geoportal.showStatus('error', 'Ha ocurrido un error inesperado');
    }
});

// Manejar errores de promesas no capturadas
window.addEventListener('unhandledrejection', function(event) {
    console.error('Promise rejection no manejada:', event.reason);
    if (geoportal) {
        geoportal.showStatus('error', 'Error de conexión');
    }
    event.preventDefault();
});
