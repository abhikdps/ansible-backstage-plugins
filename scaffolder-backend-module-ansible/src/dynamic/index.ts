import { BackendDynamicPluginInstaller } from '@backstage/backend-dynamic-feature-service';
import {
    createAnsibleContentAction,
} from '../actions/run';

export const dynamicPluginInstaller: BackendDynamicPluginInstaller = {
    kind: 'legacy',
    scaffolder: () => [createAnsibleContentAction()],
};
