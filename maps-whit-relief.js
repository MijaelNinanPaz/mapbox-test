mapboxgl.accessToken = 'pk.eyJ1IjoibWlqYWVsNiIsImEiOiJjbG1wZndzdnowMWt0MmtwbXBhdmg5dmF0In0.z8AaNTwnDOkZbFjBg3DBMw';

const data = {}
const center = [-118.1887, 34.0854];

(async () => {

    // Initialize the map
    const map = new mapboxgl.Map({
        container: 'map', // container id
        // style: 'mapbox://styles/mapbox/streets-v12',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: center, // starting position [lng, lat]
        zoom: 11.5 // starting zoom
    });

    // Initialize a marker
    const marker = new mapboxgl.Marker({
        'color': '#314ccd',
        draggable: true
    })
    .setLngLat(center) // Marker [lng, lat] coordinates
    .addTo(map); // Add the marker to map


        // ...Add terrain relief {
            // wait for map load to occur in parallel
            await map.once("style.load")
            // Set custom fog
            map.setFog({
                range: [-0.5, 2],
                color: "#def",
                "high-color": "#def",
                "space-color": "#def",
            });
            // Add terrain source, with slight exaggeration
            map.addSource("mapbox-dem", {
                type: "raster-dem",
                url: "mapbox://mapbox.terrain-rgb",
                tileSize: 512,
                maxzoom: 14,
            });
            map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
        // ... }


    async function getElevation() {
        /* We use the Tilequery API to query the Mapbox Terrain vector tileset, which includes features like topography, hillshades, and landcover.
        We use the layers parameter to get features in the contour source layer, which contains a property called ele.
        This property is the elevation value in meters, and is mapped to 10 meter height increments. */
        const query = await fetch(
        `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${data.lng},${data.lat}.json?layers=contour&limit=50&access_token=${mapboxgl.accessToken}`,
        { method: 'GET' }
        );
        if (query.status !== 200) return;
        const queryData = await query.json();
        // Get all the returned features.
        const allFeatures = queryData.features;
        // For each feature returned, we add elevation data to the elevations array.
        const elevations = allFeatures.map((feature) => feature.properties.ele);
        // In the elevations array, find the largest value.
        const highestElevation = Math.max(...elevations);

        // We obtain the elevation in feet by dividing the largest value by 0.3048
        data.elevation = Number((highestElevation/0.3048).toFixed(4));

        console.log("data", data)
    }


    function getLocationData(){

        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${data.lng},${data.lat}.json?access_token=${mapboxgl.accessToken}`)
        .then(response => response.json())
        .then((result) => {

            // Extract data from the place
            const features = result.features
            const featuresLength = features.length

            for (let i = 0; i < featuresLength; i++) {

                const myFeature = features[i];

                if (myFeature.id.includes('address')) {
                    data.address = `${myFeature.address} ${myFeature.text}`;
                    continue;
                }
                if (myFeature.id.includes('place')) {
                    data.city = myFeature.text;
                    continue;
                }
                if (myFeature.id.includes('district')) {
                    data.county = myFeature.text;
                    continue;
                }
                if (myFeature.id.includes('region')) {
                    data.state = myFeature.properties.short_code;
                    continue;
                }
                if (myFeature.id.includes('country')) {
                    data.country = myFeature.properties.short_code;
                }
            }

            // Build geojson
            data.geolocation = {
                type: 'Point',
                coordinates: [data.lng, data.lat]
            };

            getElevation()
        })
    }


    // Initialize the geocoder.
    const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        // placeholder: 'Search your home',
        // marker: {
        //   color: 'orange'
        // },
        marker: false,
        mapboxgl: mapboxgl, // Set the mapbox-gl instance
        language: 'en' // Set the language to English
    });
    // Add the geocoder to the map
    map.addControl(geocoder);


    // Event when searching for an address. We get the result of geocoder
    geocoder.on('result', (event) => {

        const result = event.result;
        // Use the returned coordinates to set the marker location
        marker.setLngLat(result.geometry.coordinates);
        // Add or update lng and lat values to data object
        data.lng = result.geometry.coordinates[0];
        data.lat = result.geometry.coordinates[1];

        // Extract data from the place
        data.address = `${result.address} ${result.text_en}`

        const context = result.context
        const contextLength = context.length

        for (let i = 0; i < contextLength; i++) {

            const myContext = context[i];

            if (myContext.id.includes('place')) {
                data.city = myContext.text;
                continue;
            }
            if (myContext.id.includes('district')) {
                data.county = myContext.text;
                continue;
            }
            if (myContext.id.includes('region')) {
                data.state = myContext.short_code;
                continue;
            }
            if (myContext.id.includes('country')) {
                data.country = myContext.short_code;
            }
        }

        // Build geojson
        data.geolocation = {
            type: 'Point',
            coordinates: [data.lng, data.lat]
        };

        getElevation();
    });


    // Event when clicking on the map
    map.on('click', (event) => {
        // Use the returned LngLat object to set the marker location
        marker.setLngLat(event.lngLat);
        // Add or update lng and lat values to data object
        data.lng = event.lngLat.lng;
        data.lat = event.lngLat.lat;
        getLocationData()
    });


    // Event when marker moves
    marker.on('dragend', (event) => {
        // get the marker location
        const newLngLat = marker.getLngLat();
        // Add or update lng and lat values to data object
        data.lng = newLngLat.lng;
        data.lat = newLngLat.lat;
        getLocationData()
    });

})();