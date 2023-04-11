import clsx from "clsx";
import { SyntheticEvent, useContext } from "react";
import { ChatContext } from "./LayoutIndex";
import styles from './layoutSider.less';
import { findLast } from 'lodash-es';

export default function LayoutSider () {

  const { result, addResult, deleteResult, toggleActive, getActiveResult } = useContext(ChatContext);

  function deleteItem (item: IConvasition) {
    return (e: SyntheticEvent) => {
      e.stopPropagation();
      deleteResult(item.sessionId);
    }
  }

  function addResultHandler () {
    const target = getActiveResult();
    // 数据正在请求或输入中，请稍后再添加新回话
    if (target?.isLoading || target?.isInput) {
      window.alert('数据正在请求或输入中，请稍后再添加新回话');
      return 
    }
    addResult();
  }

  function toggle (sessionId: string) {
    return (e: SyntheticEvent) => {
      e.stopPropagation();
      const target = result.find(r => r.sessionId === sessionId);
      // 点击当前激活页面，不做任何操作
      if (target?.active) return;
      // 正在加载中的或者正在输入中的页面，不允许切换
      if (target?.isLoading || target?.isInput) {
        window.alert('正在加载中或者正在输入中，不能切换');
        return 
      }
      toggleActive(sessionId);
    }
  }

  function getTitle (item: IConvasition) {
    if (item.isLoading) {
      return '查询中...'
    } else if (item.isInput) {
      return '输入中...'
    } else {
      return findLast(item.data, d => d.type === 'question')?.content || item.title;
    }  
  }

  return (
    <div className={styles.layoutAiSlider}>
      <div className={styles.topDiv}>
        <button type="button" onClick={addResultHandler}>+ 添加新会话</button>
      </div>
      <ul className={styles.menusUl}>
        {
          result.map((item) => {
            return (
              <li className={clsx(styles.menusLi, { [styles.active]: item.active } )}  key={item.sessionId} onClick={toggle(item.sessionId)}>
                <div className={styles.liTitle}>{getTitle(item)}</div>
                <div className={styles.liBtns}>
                  <button type="button" onClick={deleteItem(item)}>删除</button>
                </div>
              </li>
            )
          })
        }
      </ul>
    </div>
  )
}