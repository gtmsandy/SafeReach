import { Routes, Route } from 'react-router-dom';
import HomeScreen from './components/HomeScreen';
import TriageFlow from './components/TriageFlow';
import ResultsScreen from './components/ResultsScreen';
import FirstAidCard from './components/FirstAidCard';
import MapView from './components/MapView';
import CountrySelector from './components/CountrySelector';
import SettingsScreen from './components/SettingsScreen';
import EmergencyContacts from './components/EmergencyContacts';
import AccidentHistory from './components/AccidentHistory';
import NotFound from './components/NotFound';
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/triage" element={<TriageFlow />} />
      <Route path="/results" element={<ResultsScreen />} />
      <Route path="/firstaid/:protocolId" element={<FirstAidCard />} />
      <Route path="/map" element={<MapView />} />
      <Route path="/countries" element={<CountrySelector />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/emergency-contacts" element={<EmergencyContacts />} />
      <Route path="/history" element={<AccidentHistory />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
