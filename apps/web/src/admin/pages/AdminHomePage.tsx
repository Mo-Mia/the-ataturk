import { Link } from "react-router-dom";

export function AdminHomePage() {
  return (
    <section className="admin-grid">
      <div className="admin-panel">
        <h2>Sections</h2>
        <table className="admin-table">
          <tbody>
            <tr>
              <td>
                <Link to="/admin/clubs">Clubs</Link>
              </td>
              <td>Inspect squads and open player attribute editors.</td>
            </tr>
            <tr>
              <td>
                <Link to="/admin/dataset-versions">Dataset versions</Link>
              </td>
              <td>Create forks and switch the active attribute version.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
