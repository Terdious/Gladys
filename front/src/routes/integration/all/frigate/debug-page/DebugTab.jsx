import { Component } from 'preact';
import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';
import style from './style.css';

const REFRESH_INTERVAL_IN_MS = 2000;

class DebugTab extends Component {
  state = {
    messages: [],
    paused: false,
    filter: '',
    error: false
  };

  getMessages = async () => {
    if (this.state.paused) {
      return;
    }
    try {
      const messages = await this.props.httpClient.get('/api/v1/service/frigate/mqtt/debug');
      this.setState({ messages, error: false });
    } catch (e) {
      console.error(e);
      this.setState({ error: true });
    }
  };

  togglePause = () => {
    const paused = !this.state.paused;
    this.setState({ paused });
    if (!paused) {
      this.getMessages();
    }
  };

  updateFilter = e => {
    this.setState({ filter: e.target.value });
  };

  componentDidMount() {
    this.getMessages();
    this.refreshInterval = setInterval(this.getMessages, REFRESH_INTERVAL_IN_MS);
  }

  componentWillUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  render({}, { messages, paused, filter, error }) {
    const filteredMessages = filter
      ? messages.filter(
          message =>
            message.topic.toLowerCase().includes(filter.toLowerCase()) ||
            message.payload.toLowerCase().includes(filter.toLowerCase())
        )
      : messages;
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.frigate.debug.title" />
          </h1>
          <div class="card-options">
            <button
              class={cx('btn', 'btn-sm', {
                'btn-secondary': !paused,
                'btn-primary': paused
              })}
              onClick={this.togglePause}
            >
              <i class={`fe fe-${paused ? 'play' : 'pause'} mr-1`} />
              <Text id={`integration.frigate.debug.${paused ? 'resume' : 'pause'}`} />
            </button>
          </div>
        </div>
        <div class="card-body">
          <p>
            <Text id="integration.frigate.debug.description" />
          </p>
          {error && (
            <div class="alert alert-danger">
              <Text id="integration.frigate.debug.error" />
            </div>
          )}
          <div class="form-group">
            <Localizer>
              <input
                type="text"
                class="form-control"
                placeholder={<Text id="integration.frigate.debug.filterPlaceholder" />}
                value={filter}
                onInput={this.updateFilter}
              />
            </Localizer>
          </div>
          {filteredMessages.length === 0 && (
            <div class="text-muted">
              <Text id="integration.frigate.debug.emptyState" />
            </div>
          )}
          {filteredMessages.length > 0 && (
            <div class={`table-responsive ${style.messagesContainer}`}>
              <table class="table table-sm table-striped">
                <thead>
                  <tr>
                    <th class={style.nowrapCell}>
                      <Text id="integration.frigate.debug.timeColumn" />
                    </th>
                    <th>
                      <Text id="integration.frigate.debug.topicColumn" />
                    </th>
                    <th>
                      <Text id="integration.frigate.debug.payloadColumn" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMessages.map(message => (
                    <tr>
                      <td class={style.nowrapCell}>{new Date(message.received_at).toLocaleTimeString()}</td>
                      <td>
                        <code>{message.topic}</code>
                      </td>
                      <td class={style.payloadCell}>
                        <small>{message.payload}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default DebugTab;
