import React from 'react';
import { Content, Header, InfoCard, Page } from '@backstage/core-components';
import { Grid, makeStyles } from '@material-ui/core';
import { ImportStepper } from '@backstage/plugin-catalog-import';

const headerStyles = makeStyles(theme => ({
  header_title_color: {
    color: theme.palette.type === 'light' ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
  },
}));

export const CatalogImport = () => {
  const classes = headerStyles();
  return (
    <Page themeId="tools">
      <Header
        pageTitleOverride="Ansible Portal - Register Components"
        title={
          <span className={classes.header_title_color}>
            Register existing components
          </span>
        }
        style={{ background: 'inherit' }}
      />
      <Content>
        <Grid container spacing={2} direction="row-reverse">
          <Grid item xs={12} md={4} lg={6} xl={8}>
            <InfoCard title="Register Components" />
          </Grid>

          <Grid item xs={12} md={8} lg={6} xl={4}>
            <ImportStepper />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
