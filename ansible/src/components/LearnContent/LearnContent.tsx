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

import React, { useState } from 'react';
import { InfoCard, ItemCardGrid, Link } from '@backstage/core-components';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  Typography,
  makeStyles,
} from '@material-ui/core';
import AnsibleLearnIcon from '../../../images/ansible-learn.png';
import OpenInNew from '@material-ui/icons/OpenInNew';
import { labs, learningPaths } from './data';

const useStyles = makeStyles({
  container: {
    backgroundColor: 'default',
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
    color: 'rgba(0, 0, 0, 0.40)',
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
});

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
  const [showLabs, setShowLabs] = useState<boolean>(true);
  const [showLearningPaths, setShowLearningPaths] = useState<boolean>(true);

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
          <FormControl fullWidth data-testid="search-checkboxfilter-next">
            <FormControlLabel
              key="Learning Path"
              classes={{
                root: classes.checkboxWrapper,
                label: classes.textWrapper,
              }}
              label="Learning Path"
              control={
                <Checkbox
                  color="primary"
                  inputProps={{ 'aria-labelledby': 'Learning Path' }}
                  value="Learning Path"
                  name="Learning Path"
                  onChange={() => setShowLearningPaths(!showLearningPaths)}
                  checked={showLearningPaths}
                />
              }
            />
            <FormControlLabel
              key="Labs"
              classes={{
                root: classes.checkboxWrapper,
                label: classes.textWrapper,
              }}
              label="Labs"
              control={
                <Checkbox
                  color="primary"
                  inputProps={{ 'aria-labelledby': 'Learning Path' }}
                  value="Labs"
                  name="Labs"
                  onChange={() => setShowLabs(!showLabs)}
                  checked={showLabs}
                />
              }
            />
          </FormControl>
          {/* <SearchFilter.Checkbox
            name="Learn Types"
            values={['Learning Path', 'Lab']}
            defaultValue={['Learning Path', 'Lab']}
          /> */}
        </Grid>
        <Grid item xs={10}>
          {showLearningPaths && (
            <div style={{ marginBottom: '35px' }}>
              <Typography paragraph>
                <Typography paragraph>LEARNING PATHS</Typography>
                <Typography paragraph className={classes.fontSize14}>
                  Step-by-step enablement curated by Red Hat Ansible.
                </Typography>
              </Typography>
              <ItemCardGrid>
                <RenderCourses data={learningPaths} />
              </ItemCardGrid>
            </div>
          )}
          {showLabs && (
            <div>
              <Typography paragraph>LABS</Typography>
              <Typography paragraph className={classes.fontSize14}>
                Hands-on, interactive learning scenarios.
              </Typography>
              <ItemCardGrid>
                <RenderCourses data={labs} />
              </ItemCardGrid>
            </div>
          )}
        </Grid>
      </Grid>
    </>
  );
};

export const EntityLearnContent = () => {
  return <EntityLearnIntroCard />;
};
