import { createRoot } from 'react-dom/client';
import { I18nProvider } from './i18n.jsx';
import { RemoteProvider } from './remote.jsx';
import { LicenseProvider } from './license.jsx';
import App from './App.jsx';
import './styles.css';
import { markReady } from './ota.js';
import { initTv } from './tv.js';

initTv(); // remote-control keys and arrow navigation on Samsung and LG TVs

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <RemoteProvider>
      <LicenseProvider>
        <App />
      </LicenseProvider>
    </RemoteProvider>
  </I18nProvider>,
);

markReady();
