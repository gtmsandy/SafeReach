import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Plus,
  Trash2,
  User,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import {
  getContacts,
  getPrimaryContact,
  setPrimaryContact as setPrimaryContactLogic,
  addContact as addContactLogic,
  deleteContact as deleteContactLogic,
  SOS_UPDATED_EVENT,
} from '../logic/emergencyContacts';

export default function EmergencyContacts() {
  const navigate = useNavigate();

  const [contacts, setContacts] = useState(getContacts);
  const [primaryContactId, setPrimaryContactId] = useState(() => {
    const primary = getPrimaryContact();
    return primary ? primary.id : null;
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    function syncFromStorage() {
      setContacts(getContacts());
      const primary = getPrimaryContact();
      setPrimaryContactId(primary ? primary.id : null);
    }

    window.addEventListener(SOS_UPDATED_EVENT, syncFromStorage);
    window.addEventListener('storage', syncFromStorage);

    return () => {
      window.removeEventListener(SOS_UPDATED_EVENT, syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);
  function setPrimaryContact(contact) {
    setPrimaryContactLogic(contact.id);
    setPrimaryContactId(contact.id);
  }

  function handleAddContact(e) {
    e.preventDefault();
    setFormError('');

    try {
      addContactLogic({ name, phone, relationship });
      setName('');
      setPhone('');
      setRelationship('');
      setContacts(getContacts());
      const primary = getPrimaryContact();
      setPrimaryContactId(primary ? primary.id : null);
    } catch (err) {
      setFormError(err.message || 'Failed to add contact');
    }
  }

  function handleDeleteContact(id) {
    deleteContactLogic(id);
    setContacts(getContacts());
    const primary = getPrimaryContact();
    setPrimaryContactId(primary ? primary.id : null);
  }
  function handleCall(phoneNumber) {
    window.location.href = `tel:${phoneNumber}`;
  }

  return (
    <div
      className="screen"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
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
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft
              size={21}
              color="var(--text-primary)"
            />
          </button>

          <div>
            <h1
              className="text-h2"
              style={{ margin: 0 }}
            >
              Emergency Contacts
            </h1>

            <p
              className="text-label"
              style={{
                margin: '4px 0 0',
                color: 'var(--text-secondary)',
              }}
            >
              Manage people who can be contacted during an emergency
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
            background: 'var(--critical-bg)',
            border: '1px solid var(--critical-border)',
            marginBottom: 24,
          }}
        >
          <ShieldAlert
            size={24}
            color="var(--critical)"
            style={{ flexShrink: 0 }}
          />

          <div>
            <strong
              style={{
                fontSize: 14,
                color: 'var(--text-primary)',
              }}
            >
              Silent SOS Integration
            </strong>

            <p
              style={{
                margin: '5px 0 0',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Select one primary contact. SafeReach will use this
              contact when Silent SOS is activated.
            </p>
          </div>
        </div>

        {/* Add contact form */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h2
            className="text-h3"
            style={{ margin: '0 0 18px' }}
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
              {formError && (
                <div style={{ color: 'var(--critical)', fontSize: 13, fontWeight: 600 }}>
                  ⚠️ {formError}
                </div>
              )}
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
                      ? 'var(--critical)'
                      : 'var(--border)',
                  color: '#fff',
                  fontWeight: 700,
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
            className="text-h3"
            style={{ marginBottom: 14 }}
          >
            Your Emergency Contacts ({contacts.length})
          </h2>

          {contacts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'var(--bg-elevated)',
                border: '1px dashed var(--border)',
                borderRadius: 16,
                color: 'var(--text-secondary)',
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
              {contacts.map((contact) => {
                const isPrimary =
                  contact.id === primaryContactId;

                return (
                  <div
                    key={contact.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: isPrimary
                        ? '2px solid var(--critical)'
                        : '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    {/* Contact information */}
                    <div
                      style={{
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
                            background: 'var(--critical-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <User
                            size={21}
                            color="var(--critical)"
                          />
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 16,
                                color: 'var(--text-primary)',
                              }}
                            >
                              {contact.name}
                            </span>

                            {isPrimary && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '4px 7px',
                                  borderRadius: 999,
                                  background:
                                    'var(--critical-bg)',
                                  color:
                                    'var(--critical)',
                                  border:
                                    '1px solid var(--critical-border)',
                                  textTransform:
                                    'uppercase',
                                }}
                              >
                                SOS Contact
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              color: 'var(--text-secondary)',
                              fontSize: 13,
                              marginTop: 3,
                            }}
                          >
                            {contact.relationship}
                          </div>

                          <div
                            style={{
                              color: 'var(--text-primary)',
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
                          onClick={() =>
                            handleCall(contact.phone)
                          }
                          aria-label={`Call ${contact.name}`}
                          style={iconButtonStyle}
                        >
                          <Phone
                            size={18}
                            color="var(--stable)"
                          />
                        </button>

                        <button
                          onClick={() =>
                            handleDeleteContact(contact.id)
                          }
                          aria-label={`Delete ${contact.name}`}
                          style={iconButtonStyle}
                        >
                          <Trash2
                            size={18}
                            color="var(--critical)"
                          />
                        </button>
                      </div>
                    </div>

                    {/* Primary SOS selector */}
                    {!isPrimary && (
                      <button
                        onClick={() =>
                          setPrimaryContact(contact)
                        }
                        style={{
                          width: '100%',
                          marginTop: 14,
                          padding: '10px 12px',
                          borderRadius: 10,
                          border:
                            '1px solid var(--critical-border)',
                          background:
                            'var(--critical-bg)',
                          color: 'var(--critical)',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                        }}
                      >
                        <ShieldCheck size={16} />
                        Set as Primary SOS Contact
                      </button>
                    )}
                  </div>
                );
              })}
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
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
};

const iconButtonStyle = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};