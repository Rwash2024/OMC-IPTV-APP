import { createRoot } from 'react-dom/client';
import { I18nProvider } from './i18n.jsx';
import { RemoteProvider } from './remote.jsx';
import { LicenseProvider } from './license.jsx';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <RemoteProvider>
      <LicenseProvider>
        <App />
      </LicenseProvider>
    </RemoteProvider>
  </I18nProvider>,
);
