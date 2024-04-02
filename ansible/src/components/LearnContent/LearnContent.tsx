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


import React from 'react';
import { InfoCard, ItemCardGrid } from '@backstage/core-components';
import { Grid, Link, Typography, makeStyles } from '@material-ui/core';
import { CatalogFilterLayout, EntityListProvider, EntitySearchBar } from '@backstage/plugin-catalog-react';

const useStyles = makeStyles({
  container: {
    backgroundColor: 'default',
    padding: '20px',
  },
  text: {
    // color: 'white',  
    marginTop: '5px',
    fontSize: '15px', // Increase the font size as needed
  },
  divider: {
    margin: '20px 0',
    backgroundColor: 'white', // Make the divider white so it stands out on the light blue background
  },
  infoCard: {
    height: '100%',
    transition: 'all 0.25s linear',
    textAlign: 'left',
    '&:hover': {
      boxShadow: '0px 0px 16px 0px rgba(0, 0, 0, 0.8)',
    },
    '& svg': {
      fontSize: '80px',
    },
  }
});

const text =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';


 const EntityLearnIntroCard = () => {
  const classes = useStyles();
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <InfoCard>
          <Typography variant="body1" className={classes.text}>
            End to end learning journey put together by Red Hat Ansible for any user at any level.<br />
            If you are a complete beginner to Ansible, this will be the perfect place to start. If you are advanced user,<br />
            we do recommend going over and catch some stuff you missed have missed otherwise.
          </Typography>
        </InfoCard>
      </Grid>
      <EntityListProvider>
        <Grid item xs={2}>
          <CatalogFilterLayout>
            <CatalogFilterLayout.Filters>
              <EntitySearchBar />
            </CatalogFilterLayout.Filters>
            <CatalogFilterLayout.Content>
              {/* {ansibleTemplates.map((template, index) => ( */}
              Test 
            </CatalogFilterLayout.Content>
          </CatalogFilterLayout>
        </Grid>
      </EntityListProvider>
      <Grid item xs={10}>
      <div style={{marginBottom: "35px"}}>
        <Typography paragraph>
          The most basic setup is to place a bunch of cards into a large grid,
          leaving styling to the defaults. Try to resize the window to see how they
          rearrange themselves to fit the viewport.
        </Typography>
        <ItemCardGrid>
          {[...Array(10).keys()].map(index => (
            <Link href="https://google.com" target='_blank' key={index}>
              <InfoCard className={classes.infocard} title={`Card #${index}`} subheader="Subtitle" >
                {text}
              </InfoCard>
            </Link>
          ))}
        </ItemCardGrid>
      </div>
      <div>
        <Typography paragraph>
          Labs
        </Typography>
        <ItemCardGrid>
          {[...Array(10).keys()].map(index => (
            <Link href="https://google.com" target='_blank' key={index}>
              <InfoCard className={classes.infocard} title={`Card #${index}`} subheader="Subtitle" >
                {text}
              </InfoCard>
            </Link>
          ))}
        </ItemCardGrid>
      </div>
      </Grid>

    </Grid>
  )
}


export const EntityLearnContent = () => {
  return (
    <EntityLearnIntroCard />
  );
};
