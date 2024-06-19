/*
 * Copyright 2024 The Ansible plugin Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useEffect, useState } from 'react';
import { Header, Page, HeaderTabs, Content } from '@backstage/core-components';
import { EntityOverviewContent } from '../OverviewContent';
import { EntityCatalogContent } from '../CatalogContent';
import { EntityCreateContent } from '../CreateContent';
import { EntityLearnContent } from '../LearnContent';
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router';
import { Typography } from '@material-ui/core';


export const AnsibleHeader = () => {
  const headerTitle = "Welcome to the Ansible plug-ins for Red Hat Developer Hub"
  const headerSubtitle = (
    <Typography component="span" variant='subtitle1' data-testid="ansible-header">
      This Ansible out-of-the-box experience accelerates content creation and meets you where you are in the development process.
    </Typography>
  );

  return (
    <Header
      title={headerTitle}
      subtitle={headerSubtitle}
      style={{fontFamily: 'Red Hat Text', color: 'white'}}
    />
  )
}

const tabs = [
  { id: 0, label: 'Overview', nav: 'overview' },
  { id: 1, label: 'My Items', nav: 'myitems' },
  { id: 2, label: 'Create', nav: 'create' },
  { id: 3, label: 'Learn', nav: 'learn' },
];

export const AnsiblePage = () => {
  const param = useParams();
  const section = param['*'];
  const navigate = useNavigate();

  const selectedTabIndex = tabs.findIndex(
    item => item.nav === section,
  );
  const [selectedTab, setSelectedTab] = useState<any>(0);

  useEffect(() => {
    if(selectedTabIndex > -1) {
      setSelectedTab(tabs[selectedTabIndex])
    }
  }, [selectedTabIndex])

  const onTabSelect = (index: number) => {
    setSelectedTab(tabs[index]);
    navigate(tabs[index].nav);
  };
  return (
    section === '' ? <Navigate to='overview'/> : (
    <Page themeId="app">
      <AnsibleHeader />
      <HeaderTabs
        selectedIndex={selectedTab.id}
        onChange={onTabSelect}
        tabs={tabs.map(({ id, label }) => ({
          id: id.toString(),
          label,
        }))}
      />

      <Content>
        <Routes>
          <Route path="/">
            <Route
              path="overview"
              element={<EntityOverviewContent />}
            />
            <Route path="myitems" element={<EntityCatalogContent />} />
            <Route path="create" element={<EntityCreateContent />} />
            <Route path="learn" element={<EntityLearnContent />} />
          </Route>
        </Routes>
      </Content>
    </Page>
  ));
};
