import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { portalPlugin, PortalPage } from '../src/plugin';

createDevApp()
  .registerPlugin(portalPlugin)
  .addPage({
    element: <PortalPage />,
    title: 'Root Page',
    path: '/portal',
  })
  .render();
