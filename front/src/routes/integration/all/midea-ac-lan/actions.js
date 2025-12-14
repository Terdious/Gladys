import { update } from 'immutability-helper';
import createActionsIntegration from '../../../../actions/integration';

function createActions(store) {
    const integrationActions = createActionsIntegration(store);
    const actions = {
        async getDevices(state) {
            console.log('[Midea AC LAN] getDevices called');
            try {
                const devices = await state.httpClient.get('/api/v1/service/midea-ac-lan/devices');
                store.setState({
                    devices
                });
                console.log('[Midea AC LAN] getDevices successful:', devices.length, 'devices');
            } catch (error) {
                console.error('[Midea AC LAN] getDevices failed:', error);
            }
        },

        async getDiscoveredDevices(state, params = {}) {
            console.log('[Midea AC LAN] getDiscoveredDevices called with params:', params);
            try {
                const response = await state.httpClient.get('/api/v1/service/midea-ac-lan/discover', params);
                store.setState({
                    discoveredDevices: response.devices || []
                });
                console.log('[Midea AC LAN] getDiscoveredDevices successful:', (response.devices && response.devices.length) || 0, 'devices');
                return response;
            } catch (error) {
                console.error('[Midea AC LAN] getDiscoveredDevices failed:', error);
                throw error;
            }
        },
        async getHouses(state) {
            console.log('[Midea AC LAN] getHouses called');
            try {
                // Essayer d'abord avec expand
                let housesWithRooms;
                try {
                    const params = { expand: 'rooms' };
                    housesWithRooms = await state.httpClient.get('/api/v1/house', params);
                    console.log('[Midea AC LAN] getHouses with expand successful');
                } catch (expandError) {
                    console.log('[Midea AC LAN] expand failed, trying without:', expandError.message);
                    housesWithRooms = await state.httpClient.get('/api/v1/house');
                }

                store.setState({
                    housesWithRooms
                });
                console.log('[Midea AC LAN] getHouses successful:', housesWithRooms.length, 'houses');
                console.log('[Midea AC LAN] housesWithRooms structure:', housesWithRooms);
            } catch (error) {
                console.error('[Midea AC LAN] getHouses failed:', error);
            }
        },
        async transformMideaDeviceToGladys(state, device) {
            console.log('[Midea AC LAN] transformMideaDeviceToGladys called with:', device);

            try {
                const gladysDevice = await state.httpClient.post('/api/v1/service/midea-ac-lan/transform-device', device);
                console.log('[Midea AC LAN] transformed device from server:', gladysDevice);
                return gladysDevice;
            } catch (error) {
                console.error('[Midea AC LAN] transformMideaDeviceToGladys failed:', error);
                throw error;
            }
        },

        async saveDevice(state, listName, index) {
            console.log('[Midea AC LAN] saveDevice called', listName, index);
            console.log('[Midea AC LAN] state keys:', Object.keys(state));

            // Utiliser la vraie propriété du state selon le contexte
            let devices;
            if (listName === 'devices') {
                devices = state.devices || [];
            } else if (listName === 'discoveredDevices') {
                devices = state.discoveredDevices || [];
            } else {
                console.error('[Midea AC LAN] Unknown listName:', listName);
                return;
            }

            const device = devices[index];
            console.log('[Midea AC LAN] saveDevice device:', device);

            try {
                // Transformer le device Midea en device Gladys côté serveur
                const gladysDevice = await actions.transformMideaDeviceToGladys(state, device);
                console.log('[Midea AC LAN] transformed device:', gladysDevice);

                const savedDevice = await state.httpClient.post(`/api/v1/device`, gladysDevice);
                console.log('[Midea AC LAN] saveDevice successful:', savedDevice);

                const updatedDevices = update(devices, {
                    $splice: [[index, 1, savedDevice]]
                });

                store.setState({
                    [listName]: updatedDevices
                });
                console.log('[Midea AC LAN] saveDevice state updated');
            } catch (error) {
                console.error('[Midea AC LAN] saveDevice failed:', error);
                throw error;
            }
        },
        async deleteDevice(state, listName, index) {
            console.log('[Midea AC LAN] deleteDevice', listName, index);
            console.log('[Midea AC LAN] state keys:', Object.keys(state));

            // Utiliser la vraie propriété du state selon le contexte
            let devices;
            if (listName === 'devices') {
                devices = state.devices || [];
            } else if (listName === 'discoveredDevices') {
                devices = state.discoveredDevices || [];
            } else {
                console.error('[Midea AC LAN] Unknown listName:', listName);
                return;
            }

            const device = devices[index];
            console.log('[Midea AC LAN] device:', device);
            console.log('[Midea AC LAN] device.created_at:', device.created_at);
            console.log('[Midea AC LAN] device.selector:', device.selector);

            if (device.created_at) {
                try {
                    console.log('[Midea AC LAN] Calling httpClient.delete...');
                    await state.httpClient.delete(`/api/v1/device/${device.selector}`);
                    console.log('[Midea AC LAN] httpClient.delete successful');
                } catch (error) {
                    console.error('[Midea AC LAN] httpClient.delete failed:', error);
                    throw error; // Re-throw to be caught by MideaAcLanDeviceBox
                }
            }

            console.log('[Midea AC LAN] Updating state...');
            const updatedDevices = update(devices, {
                $splice: [[index, 1]]
            });
            store.setState({
                [listName]: updatedDevices
            });
            console.log('[Midea AC LAN] deleteDevice completed successfully');
        }
    };

    return actions;
}

export default createActions;
