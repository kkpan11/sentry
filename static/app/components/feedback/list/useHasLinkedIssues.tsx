import {ExternalIssueComponent} from 'sentry/components/group/externalIssuesList/types';
import useFetchSentryAppData from 'sentry/components/group/externalIssuesList/useFetchSentryAppData';
import useIssueTrackingFilter from 'sentry/components/group/externalIssuesList/useIssueTrackingFilter';
import ExternalIssueStore from 'sentry/stores/externalIssueStore';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Group, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';
import useSentryAppComponentsStore from 'sentry/utils/useSentryAppComponentsStore';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

export default function useExternalIssueData({group, event, project}: Props) {
  const organization = useOrganization();
  useFetchSentryAppData({group, organization}); // TODO: add this info onto the group directly
  const issueTrackingFilter = useIssueTrackingFilter();
  const components = useSentryAppComponentsStore({componentType: 'issue-link'});
  const externalIssues = useLegacyStore(ExternalIssueStore);
  const sentryAppInstallations = useLegacyStore(SentryAppInstallationStore);

  const renderSentryAppIssues = (): ExternalIssueComponent[] => {
    return components
      .map<ExternalIssueComponent | null>(component => {
        const {sentryApp, error: disabled} = component;
        const installation = sentryAppInstallations.find(
          i => i.app.uuid === sentryApp.uuid
        );
        // should always find a match but TS complains if we don't handle this case
        if (!installation) {
          return null;
        }

        const issue = (externalIssues || []).find(i => i.serviceType === sentryApp.slug);

        return {
          type: 'sentry-app-issue',
          key: sentryApp.slug,
          disabled,
          hasLinkedIssue: !!issue,
          props: {
            sentryApp,
            group,
            organization,
            event,
            sentryAppComponent: component,
            sentryAppInstallation: installation,
            externalIssue: issue,
            disabled,
          },
        };
      })
      .filter((x): x is ExternalIssueComponent => x !== null);
  };

  const renderIntegrationIssues = (): ExternalIssueComponent[] => {
    return (
      group.integrationIssues?.map(issue => ({
        type: 'integration-issue',
        key: issue.key,
        disabled: false,
        hasLinkedIssue: true,
        props: {
          configurations: [],
          externalIssue: issue,
          group,
          onChange: () => {},
        },
      })) ?? []
    );
  };

  const renderPluginIssues = (): ExternalIssueComponent[] => {
    return group.pluginIssues?.map((plugin, i) => ({
      type: 'plugin-issue',
      key: `plugin-issue-${i}`,
      disabled: false,
      hasLinkedIssue: true,
      props: {
        group,
        project,
        plugin,
      },
    }));
  };

  const renderPluginActions = (): ExternalIssueComponent[] => {
    return (
      group.pluginActions?.map((plugin, i) => ({
        type: 'plugin-action',
        key: `plugin-action-${i}`,
        disabled: false,
        hasLinkedIssue: false,
        props: {plugin},
      })) ?? []
    );
  };

  const linkedIssues = [
    ...renderSentryAppIssues(),
    ...renderIntegrationIssues(),
    ...renderPluginIssues(),
    ...renderPluginActions(),
  ].filter(issue => !issueTrackingFilter || issue.key === issueTrackingFilter);

  // Plugins: need to do some extra logic to detect if the issue is linked,
  // by checking if there exists an issue object
  const plugins = linkedIssues.filter(
    a =>
      (a.type === 'plugin-issue' || a.type === 'plugin-action') &&
      'issue' in a.props.plugin
  );

  // Sentry app issues: read from `hasLinkedIssue` property
  const sentryAppIssues = linkedIssues.filter(
    a =>
      a.hasLinkedIssue &&
      a.type === 'sentry-app-issue' &&
      a.props.externalIssue?.issueId === group.id
  );

  // Integration issues
  const integrationIssues = linkedIssues.filter(a => a.type === 'integration-issue');

  return {linkedIssues: plugins.concat(integrationIssues).concat(sentryAppIssues)};
}
