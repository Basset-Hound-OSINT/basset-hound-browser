import { useState } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import MonitorList from '../components/MonitorList';
import '../styles/MonitorsPage.css';

/**
 * Monitor management page
 */
function MonitorsPage() {
  const { monitors, createMonitor, updateMonitor, deleteMonitor, loading, error } =
    useDashboard();
  const [showForm, setShowForm] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    category: 'competitor',
    checkInterval: 3600000,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMonitor) {
        await updateMonitor(editingMonitor.id, formData);
      } else {
        await createMonitor(formData);
      }
      resetForm();
    } catch (err) {
      console.error('Error saving monitor:', err);
    }
  };

  const handleEdit = (monitor) => {
    setEditingMonitor(monitor);
    setFormData({
      name: monitor.name,
      url: monitor.url,
      category: monitor.category || 'competitor',
      checkInterval: monitor.checkInterval || 3600000,
    });
    setShowForm(true);
  };

  const handleDelete = async (monitorId) => {
    try {
      await deleteMonitor(monitorId);
    } catch (err) {
      console.error('Error deleting monitor:', err);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingMonitor(null);
    setFormData({
      name: '',
      url: '',
      category: 'competitor',
      checkInterval: 3600000,
    });
  };

  return (
    <div className="monitors-page">
      <div className="page-header">
        <h1>Monitor Management</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Monitor'}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {showForm && (
        <div className="monitor-form-container">
          <form className="monitor-form" onSubmit={handleSubmit}>
            <h2>{editingMonitor ? 'Edit Monitor' : 'Create New Monitor'}</h2>

            <div className="form-group">
              <label htmlFor="name">Monitor Name</label>
              <input
                id="name"
                type="text"
                placeholder="e.g., Amazon"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="url">Website URL</label>
              <input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="competitor">Competitor</option>
                  <option value="vendor">Vendor</option>
                  <option value="partner">Partner</option>
                  <option value="threat">Threat Intelligence</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="checkInterval">Check Interval (minutes)</label>
                <input
                  id="checkInterval"
                  type="number"
                  min="1"
                  value={formData.checkInterval / 60000}
                  onChange={(e) =>
                    setFormData({ ...formData, checkInterval: e.target.value * 60000 })
                  }
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-success">
                {editingMonitor ? 'Update Monitor' : 'Create Monitor'}
              </button>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <p>Loading monitors...</p>
        </div>
      ) : (
        <MonitorList
          monitors={monitors}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSelect={() => {}}
        />
      )}
    </div>
  );
}

export default MonitorsPage;
