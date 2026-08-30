import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Plus,
  Trash2,
  User,
  ShieldAlert,
} from 'lucide-react';

const STORAGE_KEY = 'emergency_contacts';

export default function EmergencyContacts() {
  const navigate = useNavigate();

  const [contacts, setContacts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  function saveContacts(updatedContacts) {
    setContacts(updatedContacts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedContacts));
  }

  function handleAddContact(e) {
    e.preventDefault();

    if (!name.trim() || !phone.trim()) return;

    const newContact = {
      id: Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      relationship: relationship.trim() || 'Emergency Contact',
    };

    saveContacts([...contacts, newContact]);

    setName('');
    setPhone('');
    setRelationship('');
  }

  function handleDeleteContact(id) {
    const updatedContacts = contacts.filter(
      (contact) => contact.id !== id
    );

    saveContacts(updatedContacts);
  }

  function handleCall(phoneNumber) {
    window.location.href = `tel:${phoneNumber}`;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg, #f8fafc)',
        padding: '24px 16px 40px',
      }}
    >
      <div
        style={{
          maxWidth: 700,
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3"
          style={{ marginBottom: 28 }}
        >
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={21} />
          </button>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              Emergency Contacts
            </h1>

            <p
              style={{
                margin: '4px 0 0',
                color: '#64748b',
                fontSize: 14,
              }}
            >
              Add people who can be contacted during an emergency
            </p>
          </div>
        </div>

        {/* Safety information */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: 16,
            borderRadius: 14,
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            marginBottom: 24,
          }}
        >
          <ShieldAlert
            size={24}
            color="#c2410c"
            style={{ flexShrink: 0 }}
          />

          <div>
            <strong style={{ fontSize: 14 }}>
              Emergency Contact Information
            </strong>

            <p
              style={{
                margin: '5px 0 0',
                fontSize: 13,
                color: '#7c2d12',
                lineHeight: 1.5,
              }}
            >
              These contacts are stored locally on your device and can be used
              for quick emergency communication.
            </p>
          </div>
        </div>

        {/* Add contact form */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              margin: '0 0 18px',
              fontSize: 18,
              fontWeight: 650,
            }}
          >
            Add Emergency Contact
          </h2>

          <form onSubmit={handleAddContact}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />

              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Relationship (e.g. Parent, Friend)"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                style={inputStyle}
              />

              <button
                type="submit"
                disabled={!name.trim() || !phone.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '13px 18px',
                  border: 'none',
                  borderRadius: 10,
                  background:
                    name.trim() && phone.trim()
                      ? '#b91c1c'
                      : '#cbd5e1',
                  color: '#fff',
                  fontWeight: 600,
                  cursor:
                    name.trim() && phone.trim()
                      ? 'pointer'
                      : 'not-allowed',
                }}
              >
                <Plus size={19} />
                Add Contact
              </button>
            </div>
          </form>
        </div>

        {/* Contacts list */}
        <div>
          <h2
            style={{
              marginBottom: 14,
              fontSize: 18,
              fontWeight: 650,
            }}
          >
            Your Emergency Contacts ({contacts.length})
          </h2>

          {contacts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#fff',
                border: '1px dashed #cbd5e1',
                borderRadius: 16,
                color: '#64748b',
              }}
            >
              <User
                size={36}
                style={{
                  margin: '0 auto 12px',
                  opacity: 0.5,
                }}
              />

              <p style={{ margin: 0 }}>
                No emergency contacts added yet.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#fef2f2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <User size={21} color="#b91c1c" />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 650,
                          fontSize: 16,
                        }}
                      >
                        {contact.name}
                      </div>

                      <div
                        style={{
                          color: '#64748b',
                          fontSize: 13,
                          marginTop: 3,
                        }}
                      >
                        {contact.relationship}
                      </div>

                      <div
                        style={{
                          color: '#475569',
                          fontSize: 13,
                          marginTop: 2,
                        }}
                      >
                        {contact.phone}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => handleCall(contact.phone)}
                      aria-label={`Call ${contact.name}`}
                      style={iconButtonStyle}
                    >
                      <Phone size={18} color="#15803d" />
                    </button>

                    <button
                      onClick={() =>
                        handleDeleteContact(contact.id)
                      }
                      aria-label={`Delete ${contact.name}`}
                      style={iconButtonStyle}
                    >
                      <Trash2 size={18} color="#dc2626" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '13px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
};

const iconButtonStyle = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};