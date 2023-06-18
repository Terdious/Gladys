import { Text } from 'preact-i18n';

const Error = ({ type }) => (
  <div class="page">
    <div class="page-content">
      <div class="container text-center">
        <div class="display-1 text-muted mb-5">
          <i class="si si-exclamation" /> 401
        </div>
        <h1 class="h2 mb-3">
          <Text id="errorNoAuthorizePage.title" />
        </h1>
        <p class="h4 text-muted font-weight-normal mb-7">
          <Text id="errorNoAuthorizePage.description" />
        </p>
        <a class="btn btn-primary" href="javascript:history.back()">
          <i class="fe fe-arrow-left mr-2" />
          <Text id="errorNoAuthorizePage.goBack" />
        </a>
      </div>
    </div>
  </div>
);
export default Error;
