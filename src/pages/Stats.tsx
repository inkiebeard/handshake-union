export function Stats() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="title">Community Stats</h1>
        <p className="subtitle has-text-grey">
          Aggregate data from the community — see how you compare.
        </p>
        <div className="columns">
          <div className="column is-4">
            <div className="box has-text-centered">
              <p className="heading">Members</p>
              <p className="title">—</p>
            </div>
          </div>
          <div className="column is-4">
            <div className="box has-text-centered">
              <p className="heading">Avg Salary Band</p>
              <p className="title">—</p>
            </div>
          </div>
          <div className="column is-4">
            <div className="box has-text-centered">
              <p className="heading">Most Common Role</p>
              <p className="title">—</p>
            </div>
          </div>
        </div>
        <div className="notification is-info is-light">
          Stats dashboard will be implemented in Phase 5. Data will populate as members join and share their info.
        </div>
      </div>
    </section>
  );
}
