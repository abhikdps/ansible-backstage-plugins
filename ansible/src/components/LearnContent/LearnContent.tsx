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
import { InfoCard, ItemCardGrid, Link } from '@backstage/core-components';
import { Grid, Typography, makeStyles } from '@material-ui/core';
import AnsibleLearnIcon from '../../../images/ansible-learn.png';
import OpenInNew from '@material-ui/icons/OpenInNew';
import { labs, learningPaths } from './data';
import {
  EntityListProvider,
} from '@backstage/plugin-catalog-react';
import {
  SearchBar,
  SearchContextProvider,
  SearchFilter,
  useSearch,
} from '@backstage/plugin-search-react';

const useStyles = makeStyles(theme => ({
  container: {
    // backgroundColor: 'default',
    padding: '20px',
  },
  flex: {
    display: 'flex',
  },
  img_wave: {
    width: '50px',
    height: '50px',
    margin: '5px',
  },
  fw_700: {
    fontWeight: 700,
  },
  ml25: {
    marginLeft: '25px',
  },
  mb40: {
    marginBottom: '40px',
  },
  fontSize14: {
    fontSize: '14px',
  },
  open_in_new: {
    width: 12,
    height: 12,
    fill: '#0066CC',
  },
  infoCard: {
    display: 'flex',
    height: '100%',
    transition: 'all 0.25s linear',
    textAlign: 'left',
    '&:hover': {
      boxShadow: '0px 0px 8px 0px rgba(0, 0, 0, 0.8)',
    },
  },
  subtitle: {
    color: theme.palette.type === 'light' ? 'rgba(0, 0, 0, 0.40)' : 'currentColor',
  },
  textDecorationNone: {
    '&:hover': {
      textDecoration: 'none',
    },
  },
  label: {
    textTransform: 'capitalize',
  },
  checkboxWrapper: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  textWrapper: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}));

const RenderCourses = ({ data }) => {
  const classes = useStyles();

  return data.map((item, index) => (
    <Link
      to={item?.link}
      target="_blank"
      key={index}
      className={classes.textDecorationNone}
    >
      <InfoCard
        className={classes.infoCard}
        title={
          <div style={{ display: 'flex' }}>
            <div>{`${index + 1}.`}</div>
            {item.name}
          </div>
        }
        subheader={
          <Typography className={`${classes.subtitle} ${classes.fontSize14}`}>
            {`${item.time} | Ansible | ${item.level} | ${item.type}`}
          </Typography>
        }
      >
        {item.description}
      </InfoCard>
    </Link>
  ));
};

const EntityLearnIntroCard = () => {
  const classes = useStyles();

  const { filters, term } = useSearch();
  const [filteredData, setFilteredData] = useState({
    learningPaths: learningPaths,
    labs: labs,
  });

  useEffect(() => {
    if (term.length > 1) {
      setFilteredData({
        learningPaths: learningPaths.filter(
          item =>
            item.name?.toLocaleLowerCase().includes(term) ||
            item.description?.toLocaleLowerCase().includes(term),
        ),
        labs: labs.filter(
          item =>
            item.name?.toLocaleLowerCase().includes(term) ||
            item.description?.toLocaleLowerCase().includes(term),
        ),
      });

    } else setFilteredData({ learningPaths: learningPaths, labs: labs });
  }, [term]);

  return (
    <>
      <Grid container spacing={3}>
        <Grid item xs={12} className={classes.mb40}>
          <InfoCard>
            <Typography variant="body1" className={classes.flex}>
              <img
                className={classes.img_wave}
                src={AnsibleLearnIcon}
                alt="Learn"
                title="Learn"
              />
              <div className={`${classes.fontSize14}`}>
                <div className={classes.fw_700}>From zero to hero!</div>
                These end-to-end learning journeys, created by Red Hat Ansible,
                are for users of all skill levels. These curated learning paths
                are a great place to start if you’re beginning your Ansible
                journey. If you are an advanced user, these learning paths are
                based on the latest Ansible Automation Platform versions and
                recommended practices. Learn more at the &nbsp;
                <Link
                  to="https://developers.redhat.com/products/ansible/overview"
                  target="_blank"
                >
                  Red Hat Developer website.
                  <OpenInNew className={classes.open_in_new} />
                </Link>
              </div>
            </Typography>
          </InfoCard>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={2}>
          <SearchBar
            debounceTime={100}
            className=""
            clearButton={false}
            placeholder="Search"
          />
          <SearchFilter.Checkbox
            name="types"
            values={['Learning Paths', 'Labs']}
            defaultValue={['Learning Paths', 'Labs']}
          />
        </Grid>
        <Grid item xs={10}>
          {filters?.types?.includes('Learning Paths') &&
            filteredData.learningPaths.length > 0 && (
              <div style={{ marginBottom: '35px' }}>
                <Typography paragraph>
                  <Typography paragraph>LEARNING PATHS</Typography>
                  <Typography paragraph className={classes.fontSize14}>
                    Step-by-step enablement curated by Red Hat Ansible.
                  </Typography>
                </Typography>
                <ItemCardGrid>
                  <RenderCourses data={filteredData.learningPaths} />
                </ItemCardGrid>
              </div>
            )}
          {filters?.types?.includes('Labs') && filteredData.labs.length > 0 && (
            <div>
              <Typography paragraph>LABS</Typography>
              <Typography paragraph className={classes.fontSize14}>
                Hands-on, interactive learning scenarios.
              </Typography>
              <ItemCardGrid>
                <RenderCourses data={filteredData.labs} />
              </ItemCardGrid>
            </div>
          )}
        </Grid>
      </Grid>
    </>
  );
};

export const EntityLearnContent = () => {
  return (
    <EntityListProvider>
      <SearchContextProvider>
        <EntityLearnIntroCard />;
      </SearchContextProvider>
    </EntityListProvider>
  );
};
