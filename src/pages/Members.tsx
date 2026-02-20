import { useMembers, formatTenure, formatJoinDate } from '../hooks/useMembers';
import { PixelAvatar } from '../components/PixelAvatar';

export function Members() {
  const { members, loading, error } = useMembers();

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <p className="prompt">members</p>
          <p className="comment">loading member directory...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="prompt">members</p>
          <div className="notification is-danger">
            <p>Failed to load members: {error}</p>
          </div>
        </div>
      </section>
    );
  }

  // Calculate aggregate stats
  const totalMembers = members.length;
  const totalMessages = members.reduce((sum, m) => sum + m.message_count, 0);
  const profilesComplete = members.filter((m) => m.profile_complete).length;
  const profileCompletionRate = totalMembers > 0 
    ? Math.round((profilesComplete / totalMembers) * 100) 
    : 0;

  return (
    <section className="section">
      <div className="container">
        <p className="prompt">members</p>
        <p className="comment mb-5">
          union directory — {totalMembers} members, {totalMessages.toLocaleString()} messages sent
        </p>

        {/* Aggregate Stats */}
        <div className="columns is-multiline mb-5">
          <div className="column is-4">
            <div className="box">
              <p className="is-size-3 has-text-weight-bold has-text-primary">
                {totalMembers}
              </p>
              <p className="is-size-7 has-text-grey">total members</p>
            </div>
          </div>
          <div className="column is-4">
            <div className="box">
              <p className="is-size-3 has-text-weight-bold has-text-info">
                {totalMessages.toLocaleString()}
              </p>
              <p className="is-size-7 has-text-grey">messages sent (all time)</p>
            </div>
          </div>
          <div className="column is-4">
            <div className="box">
              <p className="is-size-3 has-text-weight-bold has-text-success">
                {profileCompletionRate}%
              </p>
              <p className="is-size-7 has-text-grey">profiles complete</p>
            </div>
          </div>
        </div>

        {/* Member List */}
        <p className="comment mb-3">member directory</p>
        
        {members.length === 0 ? (
          <div className="box">
            <p className="has-text-grey">No members yet. Be the first to join!</p>
          </div>
        ) : (
          <div className="columns is-multiline">
            {members.map((member) => (
              <div key={member.pseudonym} className="column is-6-tablet is-4-desktop is-3-widescreen">
                <div className="box" style={{ height: '100%' }}>
                  <div className="is-flex is-align-items-center mb-3">
                    <PixelAvatar seed={member.pseudonym} size={40} />
                    <div className="ml-3">
                      <p className="has-text-weight-semibold" style={{ wordBreak: 'break-all' }}>
                        {member.pseudonym}
                      </p>
                      <p className="is-size-7 has-text-grey">
                        joined {formatJoinDate(member.member_since)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="is-flex is-justify-content-space-between is-align-items-center">
                    <div>
                      <p className="is-size-5 has-text-weight-bold">
                        {member.message_count.toLocaleString()}
                      </p>
                      <p className="is-size-7 has-text-grey">messages</p>
                    </div>
                    <div className="has-text-right">
                      <p className="is-size-6">
                        {formatTenure(member.member_since)}
                      </p>
                      <p className="is-size-7 has-text-grey">tenure</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    {member.profile_complete ? (
                      <span className="tag is-success is-light">
                        <span className="mr-1">✓</span> profile complete
                      </span>
                    ) : (
                      <span className="tag is-warning is-light">
                        <span className="mr-1">○</span> profile incomplete
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Methodology note */}
        <div className="mt-5">
          <p className="is-size-7 has-text-grey">
            Message counts are tracked independently of message content. 
            Messages are deleted after 6 hours, but the count persists. 
            No message content or metadata is exposed on this page.
          </p>
        </div>
      </div>
    </section>
  );
}
